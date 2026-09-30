"""Images d'aperçu 1200×630 (cartes de la page d'accueil + aperçu WhatsApp) à partir des pages hors ligne.
usage: python3 tools/preview.py <dossier_sortie> [lot ...]   (par défaut tous les lots de out/lots.json)"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
async def main():
    out = sys.argv[1]; lots = json.load(open(os.path.join(SRC, 'out', 'lots.json')))
    wanted = set(sys.argv[2:])
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for lot in lots:
            if wanted and lot['id'] not in wanted: continue
            f = os.path.join(SRC, 'out', 'hors-ligne', f"Cap-Ouest-{lot['name']}-maquette-3D.html")
            ctx = await b.new_context(viewport={"width": 1200, "height": 630}, offline=True); pg = await ctx.new_page()
            await pg.goto("file://" + f); await pg.wait_for_timeout(3500)
            await pg.add_style_tag(content=".card,.hint,#joy{display:none!important}")
            await pg.evaluate("window.__lot.state.radius = 15.5"); await pg.wait_for_timeout(900)
            await pg.screenshot(path=os.path.join(out, f"cap-ouest-{lot['id']}.jpg"), type="jpeg", quality=82)
            await ctx.close(); print('aperçu', lot['id'])
        await b.close()
asyncio.run(main())
