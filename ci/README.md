# 自动发布配置说明

本目录保存 GitHub Actions 工作流源文件。

## 为什么放在 `ci/` 而不是 `.github/workflows/`

当前环境的上传通道对路径含 `.github/workflows/` 的请求做了拦截（返回 404），
因此工作流源文件先存放在 `ci/release.yml`。

## 启用自动发布（一次性操作，约 30 秒）

在 GitHub 网页上把 `ci/release.yml` 移动到 `.github/workflows/release.yml` 即可：

1. 打开仓库 → 进入 `ci` 目录 → 点开 `release.yml`
2. 右上角铅笔图标（Edit）
3. 把文件名改为 `release.yml`，路径改为 `.github/workflows/release.yml`
   （GitHub 编辑器支持直接改路径：在文件名输入框中把 `ci/` 改成 `.github/workflows/`）
4. 提交

或者更简单——在本地执行：

```bash
mkdir -p .github/workflows
git mv ci/release.yml .github/workflows/release.yml   # 若已 clone
# 或直接复制
cp ci/release.yml .github/workflows/release.yml
git add .github/workflows/release.yml
git commit -m "ci: 启用自动发布工作流"
git push
```

## 启用后的效果

以后只需打 tag 并推送：

```bash
git tag v1.1.0
git push origin v1.1.0
```

工作流会自动：
1. 打包 `jian-yu-dan.zip`（排除测试文件与 md 文档）
2. 创建对应版本的 Release 并上传 zip
3. 部署 GitHub Pages

两条固定链接自动指向新版本，**URL 永不变**：

```
https://bt070512.github.io/jian-yu-dan/
https://github.com/bt070512/jian-yu-dan/releases/latest/download/jian-yu-dan.zip
```

## 当前状态（已手动配置完成，无需工作流也可正常使用）

| 项 | 状态 |
|---|---|
| GitHub Pages | ✅ 已开启（main 分支根目录） |
| Release v1.0.0 | ✅ 已发布，含 `jian-yu-dan.zip`（71.3 MB） |
| 两条固定链接 | ✅ 已验证可访问 |
| Actions 工作流 | ⏸ 待移动至 `.github/workflows/` 后生效 |

## 手动发布流程（不依赖工作流）

若暂时不想启用工作流，每次发新版手动执行：

```bash
# 1. 打包
python -c "
import zipfile, os
skipdirs={'.git','.workbuddy','node_modules','dist','build','.github','ci'}
zf=zipfile.ZipFile('jian-yu-dan.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6)
for dp,dn,fn in os.walk('.'):
    dn[:]=[d for d in dn if d not in skipdirs]
    for f in fn:
        full=os.path.join(dp,f); rel=os.path.relpath(full,'.').replace(chr(92),'/')
        if f=='jian-yu-dan.zip' or f.startswith('.wbapp_') or f.endswith('.genie') or '.bak' in f: continue
        zf.write(full,rel)
zf.close()
print('打包完成')
"

# 2. 在 GitHub 网页 Releases → Draft a new release → 填新 tag → 上传 zip → Publish
```

发布后 `/releases/latest/download/jian-yu-dan.zip` 自动指向新版本。
