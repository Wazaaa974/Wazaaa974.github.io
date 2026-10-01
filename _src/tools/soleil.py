"""Contrôle du mode Soleil : captures à des dates/heures données et bilan d'ensoleillement par pièce.
usage: python3 tools/soleil.py <page.html> <prefixe_sortie> <jour:minutes> [...]   ex. 172:1020 (21 juin, 17 h 00)
       option --vue=<nom de vue> pour une capture en visite plutôt qu'en maquette ; --dessus : vue de dessus sans interface"""
import asyncio, sys, json
from playwright.async_api import async_playwright
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
async def main():
    page, pre = sys.argv[1], sys.argv[2]; vue = next((a[6:] for a in sys.argv[3:] if a.startswith('--vue=')), None)
    moments = [a for a in sys.argv[3:] if not a.startswith('--')]
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS); ctx = await b.new_context(viewport={"width": 1100, "height": 680}, offline=True); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await pg.goto("file://" + page); await pg.wait_for_timeout(2500)
        await pg.evaluate("window.__lot.setSun(true)")
        if vue: await pg.evaluate(f"window.__lot.goTo({vue!r})")
        if '--dessus' in sys.argv:   # vue de dessus sans interface, pour voir les taches de soleil au sol
            await pg.add_style_tag(content=".card,.hint,#joy{display:none!important}")
            await pg.evaluate("(() => { const s = window.__lot.state; s.phi = 0.25; s.theta = 0.0; s.radius = 17; })()")
        for mo in moments:
            d, m = mo.split(':')
            await pg.evaluate(f"(() => {{ const S = window.__lot.SUN; S.day = {d}; S.min = {m}; document.getElementById('sunDay').value = {d}; document.getElementById('sunDay').dispatchEvent(new Event('input')); }})()")
            for _ in range(80):
                await pg.wait_for_timeout(500)
                if await pg.evaluate(f"(() => {{ const B = window.__lot.bilan(); return !!B && B.day === {d}; }})()"): break
            await pg.wait_for_timeout(600)
            info = await pg.evaluate("document.getElementById('sunNow').textContent + '\\n' + document.getElementById('sunRooms').textContent")
            print(f"--- {mo}\n{info}")
            await pg.screenshot(path=f"{pre}_{d}_{m}.png", timeout=120000)
        print('erreurs:', errs[:3]); await b.close()
asyncio.run(main())
