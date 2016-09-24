# Empyrion Blueprint Editor
## A CLI to read and edit Empyrion Blueprints

It's early days and I've not covered any new ground other than parsing the block type index and starting to identify [block IDs](https://github.com/krazyjakee/Empyrion-Blueprint-Editor/blob/master/blocktypes.json).

The big goal is to identify what the muddle of values are between the head and foot. They must contain the locations of blocks and other properties too, but it's not obvious how that data is stored.

### To contribute

You can help identify block ids by adding them in the game, overwriting the blueprint and hitting enter in the CLI to reload the blueprint. The new block will be listed as "Unknown" and you can update the [blocktypes.json](https://github.com/krazyjakee/Empyrion-Blueprint-Editor/blob/master/blocktypes.json) and send a pull request.

Byte identification. If you think you have found something, open an issue or send a pull request.

### Testing notes

My god, be sure to backup all your precious blueprints before tinkering with them.

Some HEX editors lock the blueprint file, so when overwriting in-game, Empyrion may create a new blueprint with `_1` postfixed if the blueprint is locked and/or delete the previous blueprint entirely.
