import { test } from 'node:test'
import { strictEqual } from 'node:assert'
import { stripYamlComment } from '../repo-audit.mjs'

test('yaml_field 注释剥离：裸值 + 行内注释', () => {
  strictEqual(stripYamlComment('write'), 'write')
  strictEqual(stripYamlComment('write  # OIDC Trusted Publishing'), 'write')
  strictEqual(stripYamlComment('write # 注释'), 'write')
  strictEqual(stripYamlComment('write\t# tab 后注释'), 'write')
})

test('yaml_field 注释剥离：引号内 # 不误伤', () => {
  strictEqual(stripYamlComment('"v1#2"  # 尾注释'), 'v1#2')
  strictEqual(stripYamlComment("'a#b'"), 'a#b')
  strictEqual(stripYamlComment('"# not comment"'), '# not comment')
})

test('yaml_field 注释剥离：无引号但含 # 的值（保守保留）', () => {
  // 无引号包裹时，" # " 前有空白才算注释分隔（YAML 惯例）
  strictEqual(stripYamlComment('v1#2'), 'v1#2')
})

test('yaml_field 注释剥离：仅注释与空值', () => {
  // 值整体是注释 → 空（父级为嵌套对象时保持下钻）
  strictEqual(stripYamlComment('# 整行注释'), '')
  strictEqual(stripYamlComment('  '), '')
  strictEqual(stripYamlComment('read'), 'read')
})
