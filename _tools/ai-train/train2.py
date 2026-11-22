# Train/fine-tune the ChessDepth AI square classifier and export it in the site's float16 format.
# Usage: python3 train2.py TRAIN1.npz,TRAIN2.npz OUTNAME EPOCHS [init.bin|-] [version]
import sys, json, time, numpy as np, torch, torch.nn.functional as F
sys.path.insert(0, '/mnt/user-data/uploads'); import importlib.util
spec = importlib.util.spec_from_file_location('tr', __import__('os').path.join(__import__('os').path.dirname(__file__), 'train.py')); tr = importlib.util.module_from_spec(spec); spec.loader.exec_module(tr)
Net, norm, load, evaluate = tr.Net, tr.norm, tr.load, tr.evaluate
torch.set_num_threads(2); torch.manual_seed(0); np.random.seed(0)
NAMES = ['c1w', 'c1b', 'c2w', 'c2b', 'c3w', 'c3b', 'c4w', 'c4b', 'f1w', 'f1b', 'f2w', 'f2b']
KEYS = ['c1.weight', 'c1.bias', 'c2.weight', 'c2.bias', 'c3.weight', 'c3.bias', 'c4.weight', 'c4.bias', 'f1.weight', 'f1.bias', 'f2.weight', 'f2.bias']

def from_bin(path):
    meta = json.load(open(path.replace('.bin', '.json'))); u = np.fromfile(path, np.float16).astype(np.float32); sd = {}
    for t, k in zip(meta['tensors'], KEYS): sd[k] = torch.from_numpy(u[t['offset']:t['offset'] + t['size']].reshape(t['shape']).copy())
    return sd

def export(net, base, version):
    sd = net.state_dict(); tensors, parts, off = [], [], 0
    for n, k in zip(NAMES, KEYS):
        a = sd[k].numpy().astype(np.float16).ravel(); tensors.append(dict(name=n, shape=list(sd[k].shape), offset=off, size=a.size)); parts.append(a); off += a.size
    np.concatenate(parts).tofile(base + '.bin')
    json.dump({"version": version, "input": [32, 32], "classes": list('.PNBRQKpnbrqk'), "tensors": tensors}, open(base + '.json', 'w'))

if __name__ == '__main__':
    files, out, epochs = sys.argv[1].split(','), sys.argv[2], int(sys.argv[3])
    init = sys.argv[4] if len(sys.argv) > 4 else '-'; version = sys.argv[5] if len(sys.argv) > 5 else 'v0.6'
    X, Y = load(files)
    vals = {n: (norm(np.load(f)['X']), np.load(f)['Y']) for n, f in [('seen', 'data/val_seen.npz'), ('held', 'data/val_held.npz')]}
    net = Net()
    if init != '-': net.load_state_dict(from_bin(init))
    for n, v in vals.items(): print('start', n, round(evaluate(net, *v)[0], 4), flush=True)
    lr = 1e-3 if init != '-' else 3e-3
    opt = torch.optim.Adam(net.parameters(), lr / 3, weight_decay=1e-5)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, lr, total_steps=epochs * (len(X) // 256 + 1))
    w = torch.tensor(1.0 / np.sqrt(np.bincount(Y, minlength=13) + 1), dtype=torch.float32); w = w / w.mean()
    Xt, Yt = torch.from_numpy(X), torch.from_numpy(Y.astype(np.int64))
    def tnorm(xb):
        xb = xb.float() / 255.0; m = xb.mean((1, 2), keepdim=True); sd = xb.std((1, 2), keepdim=True, unbiased=False) + 0.05
        return ((xb - m) / sd)[:, None]
    for ep in range(epochs):
        net.train(); perm = torch.randperm(len(X)); t = time.time(); tot = 0
        for i in range(0, len(X), 256):
            idx = perm[i:i + 256]; xb = tnorm(Xt[idx])
            if np.random.rand() < 0.5: xb = xb + 0.1 * torch.randn_like(xb)
            if np.random.rand() < 0.3:   # small shifts, like the second look on the site
                dx, dy = np.random.randint(-2, 3, 2); xb = torch.roll(xb, (int(dy), int(dx)), (2, 3))
            loss = F.cross_entropy(net(xb), Yt[idx], weight=w, label_smoothing=0.02)
            opt.zero_grad(); loss.backward(); opt.step(); sched.step(); tot += loss.item() * len(idx)
        msg = ' '.join(f'{n}={evaluate(net, *v)[0]:.4f}' for n, v in vals.items())
        print(f'epoch {ep + 1} loss {tot / len(X):.4f} {msg} ({time.time() - t:.0f}s)', flush=True)
        export(net, out, version)
    for n, v in vals.items():
        acc, conf = evaluate(net, *v); print(n, acc); print(conf)
