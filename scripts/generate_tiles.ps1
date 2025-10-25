Param(
  [string]$OutDir = "maps/tiles",
  [int]$TileW = 96,
  [int]$TileH = 48
)

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Load System.Drawing
Add-Type -AssemblyName System.Drawing

function New-DiamondTile {
  Param(
    [string]$Path,
    [int]$W,
    [int]$H,
    [string]$OuterHex,
    [string]$InnerHex,
    [int]$Inset = 4
  )
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $W, $H
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $gfx.Clear([System.Drawing.Color]::FromArgb(0,0,0,0))

  $outer = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($OuterHex))
  $inner = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($InnerHex))

  $hw = [int]($W/2)
  $hh = [int]($H/2)

  # Outer diamond
  $pOuter = @(
    (New-Object System.Drawing.Point -ArgumentList $hw, 0),
    (New-Object System.Drawing.Point -ArgumentList ($W-1), $hh),
    (New-Object System.Drawing.Point -ArgumentList $hw, ($H-1)),
    (New-Object System.Drawing.Point -ArgumentList 0, $hh)
  )
  $gfx.FillPolygon($outer, $pOuter)

  # Inner diamond inset
  $pInner = @(
    (New-Object System.Drawing.Point -ArgumentList $hw, $Inset),
    (New-Object System.Drawing.Point -ArgumentList ($W-1-$Inset), $hh),
    (New-Object System.Drawing.Point -ArgumentList $hw, ($H-1-$Inset)),
    (New-Object System.Drawing.Point -ArgumentList $Inset, $hh)
  )
  $gfx.FillPolygon($inner, $pInner)

  # Save PNG
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $gfx.Dispose()
  $bmp.Dispose()
}

# Generate default tiles
New-DiamondTile -Path (Join-Path $OutDir 'grass.png') -W $TileW -H $TileH -OuterHex '#1e5621' -InnerHex '#2f7d32'
New-DiamondTile -Path (Join-Path $OutDir 'stone.png') -W $TileW -H $TileH -OuterHex '#4a4f57' -InnerHex '#6b6f7a'
New-DiamondTile -Path (Join-Path $OutDir 'rock.png')  -W $TileW -H $TileH -OuterHex '#5c3b1c' -InnerHex '#8b5a2b'
New-DiamondTile -Path (Join-Path $OutDir 'water.png') -W $TileW -H $TileH -OuterHex '#174a6b' -InnerHex '#1e76a8'
New-DiamondTile -Path (Join-Path $OutDir 'bridge.png') -W $TileW -H $TileH -OuterHex '#8b6a3b' -InnerHex '#b88d4a'
New-DiamondTile -Path (Join-Path $OutDir 'bush.png')  -W $TileW -H $TileH -OuterHex '#245a2f' -InnerHex '#2f7d42'
New-DiamondTile -Path (Join-Path $OutDir 'tree.png')  -W $TileW -H $TileH -OuterHex '#1b4d2a' -InnerHex '#2f8f4e'
New-DiamondTile -Path (Join-Path $OutDir 'tallGrass.png') -W $TileW -H $TileH -OuterHex '#2faa45' -InnerHex '#58c776'
New-DiamondTile -Path (Join-Path $OutDir 'house.png') -W $TileW -H $TileH -OuterHex '#6b6f7a' -InnerHex '#8d939d'
New-DiamondTile -Path (Join-Path $OutDir 'hut.png')   -W $TileW -H $TileH -OuterHex '#7d4f2f' -InnerHex '#a36f4a'
New-DiamondTile -Path (Join-Path $OutDir 'dirt.png')  -W $TileW -H $TileH -OuterHex '#4a371f' -InnerHex '#6a4f2b'
New-DiamondTile -Path (Join-Path $OutDir 'portal.png') -W $TileW -H $TileH -OuterHex '#473e87' -InnerHex '#6a59c7'

Write-Host "Generated tiles in $OutDir"
