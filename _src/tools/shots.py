"""Captures de contrôle d'une page lot : vue d'ensemble, visites, mobile. usage: shots.py page.html prefix [pièce ...]"""
import asyncio, sys
from playwright.async_api import async_playwright
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
async def main():
    page, pre, rooms = sys.argv[1], sys.argv[2], sys.argv[3:]
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={"width": 1100, "height": 680}, offline=True); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await pg.goto("file://" + page); await pg.wait_for_timeout(3000)
        await pg.screenshot(path=f"{pre}_orbit.png")
        for r in rooms:
            await pg.evaluate(f"window.__lot.goTo({r!r})"); await pg.wait_for_timeout(900)
            info = await pg.evaluate("document.getElementById('roomName').textContent + ' · ' + document.getElementById('hsp').textContent")
            await pg.screenshot(path=f"{pre}_{r.replace(' ', '_').replace(chr(39), '')}.png"); print(r, '→', info)
        await ctx.close()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, offline=True); pg = await ctx.new_page()
        await pg.goto("file://" + page); await pg.wait_for_timeout(3000); await pg.screenshot(path=f"{pre}_mobile.png")
        print("erreurs:", errs[:3]); await b.close()
asyncio.run(main())
