import os
import math
from PIL import Image, ImageDraw, ImageFilter

SVG_CONTAINER = '''<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7FC4DD" />
      <stop offset="50%" stop-color="#5AA8C4" />
      <stop offset="100%" stop-color="#234350" />
    </linearGradient>
    <linearGradient id="drop-grad" x1="256" y1="70" x2="256" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="40%" stop-color="#E6F5FA" />
      <stop offset="100%" stop-color="#ABDBEC" />
    </linearGradient>
    <filter id="drop-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#1A323C" flood-opacity="0.3" />
    </filter>
  </defs>

  <!-- Squircle Background Tile -->
  <rect width="512" height="512" rx="128" fill="url(#bg-grad)" />

  <!-- Inner Subtle Glass Edge -->
  <rect x="12" y="12" width="488" height="488" rx="116" fill="none" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="6" />

  <!-- Main Emblem Drop -->
  <g filter="url(#drop-shadow)">
    <!-- Outer Radiant Skin Teardrop -->
    <path d="M 256 80 C 256 80 135 225 135 318 C 135 385 189 438 256 438 C 323 438 377 385 377 318 C 377 225 256 80 256 80 Z" fill="url(#drop-grad)" />

    <!-- Translucent Dermal Arc Overlay -->
    <path d="M 256 125 C 256 125 168 240 168 312 C 168 360 207 398 256 398 C 305 398 344 360 344 312 C 344 240 256 125 256 125 Z" fill="#35697D" fill-opacity="0.18" />

    <!-- AI Sparkle Core (4-Point Star inside drop) -->
    <path d="M 256 215 C 256 262 218 288 218 288 C 218 288 256 314 256 361 C 256 314 294 288 294 288 C 294 288 256 262 256 215 Z" fill="#2C5666" />

    <!-- Secondary Bright Sparkle (Top-Right of drop) -->
    <path d="M 324 172 C 324 192 306 202 306 202 C 306 202 324 212 324 232 C 324 212 342 202 342 202 C 342 202 324 192 324 172 Z" fill="#FFFFFF" />
  </g>
</svg>'''

SVG_LOGO_TRANSPARENT = '''<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="drop-grad-t" x1="256" y1="70" x2="256" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7FC4DD" />
      <stop offset="50%" stop-color="#5AA8C4" />
      <stop offset="100%" stop-color="#35697D" />
    </linearGradient>
    <linearGradient id="inner-grad-t" x1="256" y1="120" x2="256" y2="400" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#E6F5FA" />
      <stop offset="100%" stop-color="#8ECFE2" />
    </linearGradient>
    <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#35697D" flood-opacity="0.25" />
    </filter>
  </defs>

  <g filter="url(#logo-glow)">
    <!-- Outer Radiant Skin Teardrop -->
    <path d="M 256 60 C 256 60 120 215 120 315 C 120 390 180 450 256 450 C 332 450 392 390 392 315 C 392 215 256 60 256 60 Z" fill="url(#drop-grad-t)" />

    <!-- Inner Glowing Contour -->
    <path d="M 256 115 C 256 115 158 235 158 310 C 158 364 202 408 256 408 C 310 408 354 364 354 310 C 354 235 256 115 256 115 Z" fill="url(#inner-grad-t)" opacity="0.35" />

    <!-- AI Sparkle Core Star -->
    <path d="M 256 205 C 256 255 212 282 212 282 C 212 282 256 309 256 359 C 256 309 300 282 300 282 C 300 282 256 255 256 205 Z" fill="#FFFFFF" />

    <!-- Secondary Bright Sparkle -->
    <path d="M 332 160 C 332 182 312 193 312 193 C 312 193 332 204 332 226 C 332 204 352 193 352 193 C 352 193 332 182 332 160 Z" fill="#E6F5FA" />
  </g>
</svg>'''

def render_high_res_icon(size=512):
    # Render antialiased high-res image using PIL
    scale = 4
    hsize = size * scale
    img = Image.new('RGBA', (hsize, hsize), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Gradient background tile
    rx = int(128 * (hsize / 512.0))
    
    # Draw gradient rounded rect onto high resolution image
    # Generate background gradient
    bg = Image.new('RGBA', (hsize, hsize), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    
    for y in range(hsize):
        ratio = y / float(hsize)
        # Gradient #7FC4DD (127,196,221) -> #5AA8C4 (90,168,196) -> #234350 (35,67,80)
        if ratio < 0.5:
            r_t = ratio * 2
            r = int(127 * (1 - r_t) + 90 * r_t)
            g = int(196 * (1 - r_t) + 168 * r_t)
            b = int(221 * (1 - r_t) + 196 * r_t)
        else:
            r_t = (ratio - 0.5) * 2
            r = int(90 * (1 - r_t) + 35 * r_t)
            g = int(168 * (1 - r_t) + 67 * r_t)
            b = int(196 * (1 - r_t) + 80 * r_t)
        bg_draw.line([(0, y), (hsize, y)], fill=(r, g, b, 255))

    # Mask for rounded corners
    mask = Image.new('L', (hsize, hsize), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, hsize, hsize], radius=rx, fill=255)
    
    tile = Image.new('RGBA', (hsize, hsize), (0, 0, 0, 0))
    tile.paste(bg, (0, 0), mask)
    
    # Draw drop emblem onto tile
    s = hsize / 512.0

    # Helper function to convert SVG path points to polygon/curves
    # Teardrop shape approximation
    # Center x=256*s, top y=80*s, bottom y=438*s, width=242*s
    cx = 256 * s
    top_y = 80 * s
    bottom_y = 438 * s
    mid_y = 318 * s
    rx_drop = 121 * s
    
    # Draw smooth drop points
    drop_points = []
    # Top apex to bottom right curve
    N = 100
    for i in range(N):
        t = i / float(N)
        # Bezier cubic from (256, 80) control (256, 80), (377, 225) to (377, 318)
        # x(t) = (1-t)^3 * 256 + 3*(1-t)^2*t * 256 + 3*(1-t)*t^2 * 377 + t^3 * 377
        x1 = (1-t)**3 * 256 + 3*(1-t)**2*t * 256 + 3*(1-t)*t**2 * 377 + t**3 * 377
        y1 = (1-t)**3 * 80 + 3*(1-t)**2*t * 150 + 3*(1-t)*t**2 * 225 + t**3 * 318
        drop_points.append((x1 * s, y1 * s))

    # Bottom arc from (377, 318) to (135, 318) via (256, 438)
    for i in range(N + 1):
        angle = (i / float(N)) * math.pi
        x1 = 256 + 121 * math.cos(angle)
        y1 = 318 + 120 * math.sin(angle)
        drop_points.append((x1 * s, y1 * s))

    # Left curve back to top apex (135, 318) to (256, 80)
    for i in range(N):
        t = i / float(N)
        x1 = (1-t)**3 * 135 + 3*(1-t)**2*t * 135 + 3*(1-t)*t**2 * 256 + t**3 * 256
        y1 = (1-t)**3 * 318 + 3*(1-t)**2*t * 225 + 3*(1-t)*t**2 * 150 + t**3 * 80
        drop_points.append((x1 * s, y1 * s))

    # Draw white drop on top
    drop_img = Image.new('RGBA', (hsize, hsize), (0, 0, 0, 0))
    drop_draw = ImageDraw.Draw(drop_img)
    drop_draw.polygon(drop_points, fill=(255, 255, 255, 255))
    
    # AI Sparkle star (center 256, 288)
    # Top (256, 215), Right (294, 288), Bottom (256, 361), Left (218, 288)
    # Curves inwards
    star_points = []
    def star_curve(p0, p1, ctrl, steps=20):
        res = []
        for i in range(steps):
            t = i / float(steps)
            x = (1-t)**2 * p0[0] + 2*(1-t)*t * ctrl[0] + t**2 * p1[0]
            y = (1-t)**2 * p0[1] + 2*(1-t)*t * ctrl[1] + t**2 * p1[1]
            res.append((x * s, y * s))
        return res

    p_top = (256, 215)
    p_right = (294, 288)
    p_bottom = (256, 361)
    p_left = (218, 288)
    c_center = (256, 288)
    
    star_points.extend(star_curve(p_top, p_right, c_center))
    star_points.extend(star_curve(p_right, p_bottom, c_center))
    star_points.extend(star_curve(p_bottom, p_left, c_center))
    star_points.extend(star_curve(p_left, p_top, c_center))

    drop_draw.polygon(star_points, fill=(44, 86, 102, 255)) # teal-700 #2C5666

    # Secondary small sparkle (324, 202)
    sp_top = (324, 172)
    sp_right = (342, 202)
    sp_bottom = (324, 232)
    sp_left = (306, 202)
    sp_center = (324, 202)
    small_star_pts = []
    small_star_pts.extend(star_curve(sp_top, sp_right, sp_center))
    small_star_pts.extend(star_curve(sp_right, sp_bottom, sp_center))
    small_star_pts.extend(star_curve(sp_bottom, sp_left, sp_center))
    small_star_pts.extend(star_curve(sp_left, sp_top, sp_center))
    drop_draw.polygon(small_star_pts, fill=(255, 255, 255, 255))

    # Paste drop on tile
    tile.paste(drop_img, (0, 0), drop_img)

    # Downsample with Lanczos filter for smooth antialiasing
    final_icon = tile.resize((size, size), Image.Resampling.LANCZOS)
    return final_icon

def generate_all():
    web_app_dir = r"d:\AI_Nirman\AI Nirman 5 project\P2_AI_Skin_Analysis\skin-analysis-platform\apps\web"
    app_dir = os.path.join(web_app_dir, "app")
    public_dir = os.path.join(web_app_dir, "public")

    # 1. Write SVG files
    with open(os.path.join(app_dir, "icon.svg"), "w", encoding="utf-8") as f:
        f.write(SVG_CONTAINER)
    with open(os.path.join(public_dir, "icon.svg"), "w", encoding="utf-8") as f:
        f.write(SVG_CONTAINER)
    with open(os.path.join(public_dir, "logo.svg"), "w", encoding="utf-8") as f:
        f.write(SVG_LOGO_TRANSPARENT)

    # 2. Render PNG images
    img512 = render_high_res_icon(512)
    img192 = render_high_res_icon(192)
    img180 = render_high_res_icon(180)
    img64 = render_high_res_icon(64)
    img32 = render_high_res_icon(32)
    img16 = render_high_res_icon(16)

    # Save PNGs
    img512.save(os.path.join(app_dir, "icon.png"))
    img180.save(os.path.join(app_dir, "apple-icon.png"))

    img512.save(os.path.join(public_dir, "icon.png"))
    img512.save(os.path.join(public_dir, "logo.png"))
    img180.save(os.path.join(public_dir, "apple-touch-icon.png"))

    # Save multi-size favicon.ico
    ico_img = render_high_res_icon(256)
    ico_path_app = os.path.join(app_dir, "favicon.ico")
    ico_path_public = os.path.join(public_dir, "favicon.ico")
    
    ico_img.save(ico_path_app, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    ico_img.save(ico_path_public, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

    print("All favicon and logo files successfully generated and saved!")

if __name__ == "__main__":
    generate_all()
