<!-- ===== append：dsh-plugin 分类段（拼接到 README-core 之后） ===== -->

[![npm version](https://img.shields.io/npm/v/dsh-<name>.svg)](https://www.npmjs.com/package/dsh-<name>)


- <功能点 1：一句话说清用户得到什么>
- <功能点 2>
- （矩阵实测新增功能点）模板升级新增说明。

## 安装

> 要求 dsh 宿主 >= <peer 版本，如 0.1.2-alpha.4>（见 package.json peerDependencies；旧宿主用户用 <兼容的旧版>）。

```sh
dsh plugin add dsh-<name>
# 或在 profile 的 package.json 加：dsh-<name>: ^x.y.z
# 然后重启 / 重载挂载它的 profile
```

## 使用

<最小可复制示例：命令 / 工具调用 / 点击路径。示例代码块必须可直接粘贴执行。>

## 配置

| 配置项 | 默认 | 说明 |
|---|---|---|
| `<field>` | `<default>` | <作用与生效方式（live / 重启生效）> |
