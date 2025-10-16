from __future__ import annotations
import os
from pathlib import Path
from fastapi.testclient import TestClient
from .main import app

client = TestClient(app)


def run():
    # Health
    r = client.get('/health')
    print('health:', r.status_code, r.json())

    # Generate a synthetic image (green block) and test
    from PIL import Image
    import io
    img = Image.new('RGB', (256,256), (34,139,34))
    bio = io.BytesIO()
    img.save(bio, format='PNG')
    bio.seek(0)

    files = {
        'image': ('tree.png', bio.getvalue(), 'image/png')
    }
    data = { 'latitude': '12.34', 'longitude': '56.78' }
    r2 = client.post('/verify-tree', files=files, data=data)
    print('verify-tree:', r2.status_code, r2.json())

if __name__ == '__main__':
    run()
