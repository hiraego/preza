"""PDF из build/jpg/*.jpg: каждая страница = одна картинка 2560x1440, живого текста нет."""
import pathlib

import img2pdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
JPG = sorted((ROOT / 'build/jpg').glob('*.jpg'))
OUT = ROOT / 'dist/Аладько_Известные_зарубежные_экологи.pdf'
OUT.parent.mkdir(exist_ok=True)

# 16:9, 338.67 x 190.5 мм (как слайд PowerPoint)
layout = img2pdf.get_layout_fun((img2pdf.in_to_pt(13.333), img2pdf.in_to_pt(7.5)), fit=img2pdf.FitMode.into)
OUT.write_bytes(img2pdf.convert([str(p) for p in JPG], layout_fun=layout,
                                title='Известные зарубежные экологи', author='Аладько Иван Игоревич'))
print(f'{OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1e6:.1f} МБ, страниц {len(JPG)}')
