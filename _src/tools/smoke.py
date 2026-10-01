"""Test de fumée : chaque page hors ligne se charge, le moteur démarre, aucune erreur console. Code de sortie 1 sinon."""
import asyncio, glob, os, sys
from playwright.async_api import async_playwright
SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
async def main():
    bad = 0
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for f in sorted(glob.glob(os.path.join(SRC, 'out', 'hors-ligne', '*.html'))):
            ctx = await b.new_context(viewport={"width": 900, "height": 600}, offline=True); pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            await pg.goto("file://" + f); await pg.wait_for_timeout(2500)
            ok = await pg.evaluate("!!(window.__lot && window.__lot.state)")
            if ok:
                for v in await pg.evaluate("Object.keys(window.GEO.views)"):
                    await pg.evaluate(f"window.__lot.goTo({v!r})")
                await pg.wait_for_timeout(300)
            name = os.path.basename(f); status = 'OK' if ok and not errs else 'ÉCHEC'
            if status != 'OK': bad += 1
            print(f"{status:5s} {name}  {errs[:2] if errs else ''}")
            await ctx.close()
        await b.close()
    sys.exit(1 if bad else 0)
asyncio.run(main())
