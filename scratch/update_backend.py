import os

path = r'C:\Users\USER\Desktop\FYP-26-POTHOLE-DETECTION\app\api\v1\endpoints\detect.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '    if not image.content_type or not image.content_type.startswith("image/"):\n        raise HTTPException(status_code=400, detail="File must be an image (JPEG or PNG).")'

replacement = '''    is_img = (
        (image.content_type and image.content_type.startswith("image/"))
        or (image.filename and image.filename.lower().endswith(
            (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".heic", ".heif", ".avif", ".tiff")
        ))
    )
    if not is_img:
        raise HTTPException(status_code=400, detail="File must be a valid image.")'''

if content.count(target) == 2:
    new_content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('SUCCESS: Updated backend detect.py')
else:
    print('COUNT MATCHES:', content.count(target))
