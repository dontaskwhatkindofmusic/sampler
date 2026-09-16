from pathlib import Path
import hashlib,re
root=Path(__file__).resolve().parent.parent
worker=root/'sw.js';source=worker.read_text()
files=re.search(r'const FILES=\[(.*?)\];',source).group(1)
names=re.findall(r"'([^']+)'",files)
normalized=re.sub(r"const REVISION = '[^']+';","const REVISION = 'pending';",source)
digest=hashlib.sha256(normalized.encode())
for name in names:digest.update(name.encode());digest.update((root/name).read_bytes())
version=digest.hexdigest()[:16]
worker.write_text(re.sub(r"const REVISION = '[^']+';",f"const REVISION = '{version}';",source))
print('Offline bundle:',version)
