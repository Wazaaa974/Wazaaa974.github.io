"""Non-régression : même scénario sur l'ancienne et la nouvelle page, captures côte à côte.
usage: python3 compare.py OLD.html NEW.html PREFIX [scenario...]"""
import asyncio, sys
from playwright.async_api import async_playwright
from PIL import Image, ImageChops, ImageStat

OLD, NEW, PREFIX = sys.argv[1:4]
SCEN = sys.argv[4:] or ["orbit", "visit:Séjour", "visit:Cuisine", "kitB"]
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]

async def shoot(b, url, scen, out, vp):
    ctx = await b.new_context(viewport=vp, offline=True)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    await pg.goto("file://" + url); await pg.wait_for_timeout(3000)
    await pg.add_style_tag(content=".card,.hint,#joy{visibility:hidden!important}")
    if scen.startswith("visit:"):
        await pg.evaluate(f"window.__a201.goTo({scen[6:]!r})")
    elif scen == "kitB":
        await pg.evaluate("document.getElementById('kB').click(); window.__a201.goTo('Cuisine')")
    else:
        await pg.evaluate("window.__a201.state.radius = 19")
    await pg.wait_for_timeout(1200)
    await pg.screenshot(path=out)
    await ctx.close()
    return errs

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for scen in SCEN:
            tag = scen.replace(":", "_").replace(" ", "")
            eo = await shoot(b, OLD, scen, f"{PREFIX}_{tag}_old.png", {"width": 900, "height": 560})
            en = await shoot(b, NEW, scen, f"{PREFIX}_{tag}_new.png", {"width": 900, "height": 560})
            a, c = Image.open(f"{PREFIX}_{tag}_old.png").convert("RGB"), Image.open(f"{PREFIX}_{tag}_new.png").convert("RGB")
            d = ImageChops.difference(a, c).convert("L"); changed = sum(1 for v in d.getdata() if v > 24) / (d.width * d.height)
            s = Image.new("RGB", (a.width * 2 + 8, a.height), "white"); s.paste(a, (0, 0)); s.paste(c, (a.width + 8, 0)); s.save(f"{PREFIX}_{tag}.png")
            print(f"{scen:16s} pixels changés {changed*100:5.1f} %  erreurs ancien={eo[:2]} nouveau={en[:2]}")
        await b.close()
asyncio.run(main())
