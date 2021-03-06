const readline = require('readline');
const fs = require('fs');
const regedit = require('regedit');

const block_types = require('./blocktypes.json').blocktypes;

const cli = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

var steam_path = "";
var blueprints_directory = "";
var active_blueprint = {};

var get_steam_install_directory = function(){
	var reg_path = 'HKCU\\SOFTWARE\\Valve\\Steam';
	return new Promise(function(next, reject){
		regedit.list(reg_path, function (err, result) {
		    if(result){
		    	var steam_path_keys = result[reg_path].values['SteamPath'];
		    	if(steam_path_keys){
		    		steam_path = steam_path_keys.value;
		    		console.log("Got steampath from registry!");
		    		next();
		    	}else{
		    		console.log("Unable to locate steampath.");
		    	}
		    }else{
		    	console.log("Cannot access registry, please run as administrator.");
		    }
		});
	});
}

var get_files = function(containing_path){
	return new Promise(function(next, reject){
		fs.readdir(containing_path, function (err, files) {
		    if (err) {
		        return console.error(err);
		    }
		    var dir_files = [[],[]];
		    for (var index = 0; index < files.length; ++index) { 
	            var file = files[index]; 
	            if (file[0] !== '.') { 
	                var filePath = containing_path + '/' + file; 
	                var stat = fs.statSync(filePath);
                    if (stat.isDirectory()) { 
                        dir_files[0].push(file); 
                    }else{
                    	dir_files[1].push(file); 
                    }
                    if (files.length === (index + 1)) {
                        next(dir_files); 
                    }
	            }
	        }
		});
	});
}

var read_binary_file = function(file_path){
	return new Promise(function(next, reject){
		var readStream = fs.createReadStream(file_path);
		var all_chunks = "";
		readStream.on('data', function (chunk) {
		  all_chunks += chunk.toString('hex');
		}).on('close', function(){
			active_blueprint.bytes = all_chunks.match(/.{2}/g)
			next();
		});
	});
}

var hex2int = function(bytes){
	return parseInt("0x" + bytes, 16);
}

var hex2string = function(bytes){
	return bytes.map(function(b){
		return String.fromCharCode(hex2int(b));
	}).join('');
}

var get_data = {
	
	type: function(){
		switch(active_blueprint.bytes[8]){
			case "00": return "Unknown";
			case "02": return "Base";
			case "04": return "Small Vessel";
			case "08": return "Capital Vessel";
			case "10": return "Hovercraft";
		}
	},

	blocks: function(){

		var ab = active_blueprint.bytes;

		// Parse block type index
		var type_count = hex2int(ab[137] + ab[136]);
		var type_index = [];
		var start_byte = 138;
		var end_bytes = start_byte + (type_count * 8);
		for(var i = start_byte; i < end_bytes; i += 8){
			var id = hex2int(ab[i]);
			var b_type = ab.slice(i, i + 8);
			type_index.push({
				id: id,
				name: block_types[id] || "Unknown",
				count: hex2int(b_type[5] + b_type[4]),
				category: parseInt(b_type[1])
			});
		}

		// Parse unit group (control panel group) index
		var unit_group_index = [];
		var start_byte = (138 + (type_count * 8)) + 2;
		var unit_group_count = hex2int(ab[start_byte - 1]);
		
		var i = 0,
		unit_group_index_progress = 0;
		while(i < unit_group_count){
			unit_group_index_progress++; // bypass padding byte
			var string_length = hex2int(ab[start_byte + unit_group_index_progress]); // length of the following string
			unit_group_index_progress++; // next
			var name = hex2string(ab.slice(start_byte + unit_group_index_progress, start_byte + unit_group_index_progress + string_length));
			unit_group_index_progress += string_length + 1; // next plus a padding byte with value 1
			var group_item_count = hex2int(ab[start_byte + unit_group_index_progress]); // number of items in the group
			unit_group_index_progress++; // next

			data = [];
			var j = group_item_count;
			while(j){
				unit_group_index_progress++;
				data.push(ab.slice(start_byte + unit_group_index_progress, start_byte + unit_group_index_progress + 4));
				unit_group_index_progress += 4;
				j--;
			}

			unit_group_index.push({
				name: name,
				item_count: group_item_count,
				data: data
			});
			i++;
		}


		return {
			count: hex2int(ab[133] + ab[132]),
			type_count: type_count,
			types: type_index,
			unit_groups: unit_group_index,
			width: hex2int(ab[9]),
			height: hex2int(ab[13]),
			depth: hex2int(ab[17]),
		}
	}
}

var read_blueprint = function(){
	return new Promise(function(next, reject){
		read_binary_file(active_blueprint.file).then(function(){
			active_blueprint.type = get_data.type();
			active_blueprint.blocks = get_data.blocks();
			console.log(JSON.stringify(active_blueprint.blocks, null, 4));
			next();
		});
	});
}

var cli_reload = function(){

	cli.question("Press enter to reload blueprint.", function(answer){
		read_blueprint().then(cli_reload);
	});

}

get_steam_install_directory().then(function(){
	blueprints_directory = steam_path + "/SteamApps/common/Empyrion - Galactic Survival/Saves/Blueprints";
	get_files(blueprints_directory).then(function(files){
		return new Promise(function(next, reject){
			var directories = files[0];
			var directories_length = directories.length;
			var blueprints = [];
			for(var i = 0; i < directories.length; i++){
				var steam_id = directories[i];
				get_files(blueprints_directory + "/" + steam_id).then(function(files){
					var subdirectories = files[0];
					for(var j = 0; j < subdirectories.length; j++){
						blueprints.push({name: subdirectories[j], directory: blueprints_directory + "/" + steam_id + "/" + subdirectories[j]})
					}
					directories_length--;
					if(directories_length == 0){
						console.log("Got a list of Blueprint folders!")
						next(blueprints);
					}
				});
			}
		});
	}).then(function(blueprints){
		return new Promise(function(next, reject){
			var question = "";
			for(var i = 0; i < blueprints.length; i++){
				question += "\n" + i + ": " + blueprints[i].name;
			}
			question += "\n\nWhich blueprint would you like to edit? ";

			cli.question(question, function(answer){
				active_blueprint = blueprints[answer];
				console.log("Selected " + active_blueprint.name)
				next();
			});
		});
	}).then(function(){
		return new Promise(function(next, reject){
			get_files(active_blueprint.directory).then(function(files){
				files = files[1];
				for(var i = 0; i < files.length; i++){
					var file = files[i];
					if(file.indexOf('.epb') > -1){
						active_blueprint.file = active_blueprint.directory + "/" + file;
						console.log("Reading bytes...")
						read_binary_file(active_blueprint.file).then(next);
					}
				}
			});
		});
	}).then(function(){
		read_blueprint().then(cli_reload);
	});
});