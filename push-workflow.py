"""最终方案：以现有 main tree 为 base_tree，增量追加 .github/workflows/release.yml。

用 base_tree 时请求体只含新增条目，极小，可规避代理截断。
"""
import base64
import json
import sys
import urllib.error
import urllib.request

TOKEN = os.environ.get('GH_TOKEN', '')
API = 'https://api.github.com/repos/bt070512/jian-yu-dan'


def call(method, url, payload=None, retries=6):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header('Authorization', 'Bearer ' + TOKEN)
    r.add_header('Accept', 'application/vnd.github+json')
    r.add_header('Content-Type', 'application/json')
    r.add_header('User-Agent', 'wbsync')
    last = None
    for a in range(retries):
        try:
            with urllib.request.urlopen(r, timeout=120) as resp:
                b = resp.read()
                if not b:
                    return {}
                try:
                    return json.loads(b)
                except Exception:
                    last = 'JSON parse fail: ' + b[:200].decode('utf-8', 'replace')
                    continue
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', 'replace')
            last = f'HTTP {e.code}: {body[:200]}'
            if e.code in (404, 422, 502, 503, 504):
                import time
                time.sleep(2 + a)
                continue
            break
        except Exception as e:
            last = str(e)
            import time
            time.sleep(2 + a)
    raise RuntimeError(last)


# 1. workflow blob
wf = open('.github/workflows/release.yml', 'rb').read()
wf_sha = call('POST', API + '/git/blobs',
              {'content': base64.b64encode(wf).decode(), 'encoding': 'base64'})['sha']
print('wf blob:', wf_sha[:8])

# 2. 取当前 main 的 tree sha（作为 base_tree）
head = call('GET', API + '/git/ref/heads/main')
parent = head['object']['sha']
base_tree = call('GET', API + '/git/commits/' + parent)['tree']['sha']
print('parent:', parent[:8], 'base_tree:', base_tree[:8])

# 3. 增量 tree：只加 .github/workflows/release.yml（GitHub 自动建中间目录）
tree = call('POST', API + '/git/trees', {
    'base_tree': base_tree,
    'tree': [{
        'path': '.github/workflows/release.yml',
        'mode': '100644',
        'type': 'blob',
        'sha': wf_sha,
    }],
})
print('new tree:', tree['sha'][:8])

# 4. 建 commit 并立即回读校验
commit = call('POST', API + '/git/commits', {
    'message': 'ci: 添加自动发布工作流（打 tag 即发 Release + 部署 Pages）',
    'tree': tree['sha'],
    'parents': [parent],
})
csha = commit.get('sha', '')
print('commit resp sha:', csha[:8] if csha else '(empty)')
if len(csha) < 40:
    raise SystemExit('commit sha 无效，终止以免破坏 main')

# 回读校验：确认 commit 真实存在
verify = call('GET', API + '/git/commits/' + csha)
assert verify.get('sha') == csha, 'commit 回读不一致'
print('commit 校验通过')

# 5. 更新 ref
ref = call('PATCH', API + '/git/refs/heads/main', {'sha': csha, 'force': True})
newsha = ref.get('object', {}).get('sha', '')
if newsha != csha:
    raise SystemExit(f'ref 更新异常: {ref}')
print('ref 更新成功 ->', newsha[:8])
print('DONE')
