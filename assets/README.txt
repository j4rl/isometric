Place your PNG textures in this folder.

Expected default paths (can be changed in src/main.js):

tiles/
  - grass.png
  - stone.png
  - rock.png (obstacle)

entities/
  - player.png
  - enemy.png
  - bullet.png
  - slash.png

Tip: Use sprites whose bottom aligns with the tile bottom.

Placeholders:
- If these PNG files are missing, the engine auto-generates placeholders at runtime so the demo runs immediately.
- For player/enemy/slash, spritesheets are supported with uniform frames (see fw/fh/fps in src/main.js).
