# Train the ChessDepth AI square classifier (32x32 grayscale crop -> 13 classes).
import sys, time, numpy as np, torch, torch.nn as nn, torch.nn.functional as F
torch.set_num_threads(2); torch.manual_seed(0)

class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.c1 = nn.Conv2d(1, 16, 3, padding=1); self.c2 = nn.Conv2d(16, 32, 3, padding=1)
        self.c3 = nn.Conv2d(32, 64, 3, padding=1); self.c4 = nn.Conv2d(64, 64, 3, padding=1)
        self.f1 = nn.Linear(64 * 4 * 4, 128); self.f2 = nn.Linear(128, 13)
    def forward(self, x):
        x = F.max_pool2d(F.relu(self.c1(x)), 2)          # 16x16
        x = F.max_pool2d(F.relu(self.c2(x)), 2)          # 8x8
        x = F.relu(self.c3(x))
        x = F.max_pool2d(F.relu(self.c4(x)), 2)          # 4x4
        x = F.relu(self.f1(x.flatten(1)))
        return self.f2(x)

def load(files):
    X, Y = [], []
    for f in files:
        d = np.load(f); X.append(d['X']); Y.append(d['Y'])
    return np.concatenate(X), np.concatenate(Y)

def norm(X):  # per-crop normalisation makes the model robust to board colours
    X = X.astype(np.float32) / 255.0
    m = X.mean(axis=(1, 2), keepdims=True); s = X.std(axis=(1, 2), keepdims=True) + 0.05
    return ((X - m) / s)[:, None]

def evaluate(net, X, Y):
    net.eval(); correct = 0; conf = np.zeros((13, 13), int)
    with torch.no_grad():
        for i in range(0, len(X), 4096):
            p = net(torch.from_numpy(X[i:i + 4096])).argmax(1).numpy()
            for a, b in zip(Y[i:i + 4096], p): conf[a, b] += 1
    return (np.trace(conf) / conf.sum()), conf

if __name__ == '__main__':
    train_files = sys.argv[1].split(','); out = sys.argv[2]; epochs = int(sys.argv[3])
    X, Y = load(train_files); X = norm(X)
    vals = {n: (norm(np.load(f)['X']), np.load(f)['Y']) for n, f in [('seen', 'data/val_seen.npz'), ('held', 'data/val_held.npz')]}
    net = Net(); opt = torch.optim.Adam(net.parameters(), 2e-3)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, 3e-3, total_steps=epochs * (len(X) // 256 + 1))
    w = torch.tensor(1.0 / np.sqrt(np.bincount(Y, minlength=13) + 1), dtype=torch.float32); w = w / w.mean()
    Xt, Yt = torch.from_numpy(X), torch.from_numpy(Y)
    for ep in range(epochs):
        net.train(); perm = torch.randperm(len(X)); t = time.time(); tot = 0
        for i in range(0, len(X), 256):
            idx = perm[i:i + 256]; xb = Xt[idx]
            if np.random.rand() < 0.5: xb = xb + 0.1 * torch.randn_like(xb)
            loss = F.cross_entropy(net(xb), Yt[idx], weight=w)
            opt.zero_grad(); loss.backward(); opt.step(); sched.step(); tot += loss.item() * len(idx)
        msg = ' '.join(f'{n}={evaluate(net, *v)[0]:.4f}' for n, v in vals.items())
        print(f'epoch {ep + 1} loss {tot / len(X):.4f} {msg} ({time.time() - t:.0f}s)', flush=True)
    torch.save(net.state_dict(), out)
    for n, v in vals.items():
        acc, conf = evaluate(net, *v); print(n, acc); print(conf)
