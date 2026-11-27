import sys, numpy as np, torch
sys.argv=[sys.argv[0]]+sys.argv[1:]
from train2 import Net, from_bin, export, evaluate, norm
a, b, alpha, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
sa, sb = from_bin(a), from_bin(b)
net = Net(); net.load_state_dict({k: (1 - alpha) * sa[k].float() + alpha * sb[k].float() if sa[k].is_floating_point() else sa[k] for k in sa})
for n, f in [('seen', 'data/val_seen.npz'), ('held', 'data/val_held.npz'), ('kag', 'data/kval.npz')]:
    d = np.load(f); print(n, round(evaluate(net, norm(d['X']), d['Y'])[0], 4))
export(net, out, 'v0.7')
