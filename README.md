# Smart Contract Compile Demo

這個專案使用 `solc-js` 直接編譯 Solidity 合約，輸出 ABI 與 bytecode 到 `artifacts/`。

## 專案架構

```text
smart_contract/
|- contracts/
|  |- 00_MyState.sol
|- scripts/
|  |- compile.js
|- artifacts/
|  |- 00_MyState/
|     |- A.json
|     |- B.json
|     |- C.json
|- package.json
|- package-lock.json
```

## 環境需求

- Node.js 18+
- npm

## 安裝

```bash
npm install
```

## 使用方法

### VS Code 按鈕與快捷鍵

本專案已提供 `.vscode/` 設定，支援直接在 VS Code 觸發編譯：

- `Run Code`（Code Runner 按鈕）: 在 `.sol` 檔會執行目前檔案編譯
- `Ctrl+Shift+B`: 執行預設 Build Task（編譯目前開啟的 `.sol`）
- `Run and Debug`:
  - `Compile Active Solidity (Run and Debug)`
  - `Compile All Solidity (Run and Debug)`

建議在 `contracts/` 內打開目標 `.sol` 再按按鈕，會自動帶入目前檔案路徑。

### 1) 編譯預設檔案

預設會編譯 `contracts/00_MyState.sol`。

```bash
npm run compile
```

### 2) 編譯指定合約檔

```bash
npm run compile -- 00_MyState.sol
```

也可以直接傳路徑（推薦，方便用 `Tab` 補檔名）：

```bash
npm run compile -- contracts/00_MyState.sol
```

### 3) 編譯所有合約

```bash
npm run compile:all
# 等同於
npm run compile -- --all
```

## 可用參數

`compile.js` 支援以下參數：

- `--all`: 編譯 `contracts/` 底下所有 `.sol`
- `--evm <version>`: 指定 EVM 版本，例如 `paris`、`shanghai`
- `--solc <version>`: 指定 Solidity 編譯器版本，例如 `0.8.34`
- `--help` 或 `-h`: 顯示說明

範例：

```bash
npm run compile -- 00_MyState.sol --evm paris
npm run compile -- contracts/00_MyState.sol --evm paris
npm run compile -- 00_MyState.sol --solc 0.8.34
npm run compile -- --all --evm shanghai --solc 0.8.34
```

PowerShell `Tab` 補完建議：

```powershell
npm run compile -- .\contracts\<Tab>
```

也可用環境變數指定：

- `EVM_VERSION`
- `SOLC_VERSION`

PowerShell 範例：

```powershell
$env:EVM_VERSION="paris"
$env:SOLC_VERSION="0.8.34"
npm run compile
```

## 編譯輸出

每次編譯會先清空 `artifacts/`，再輸出新的結果。

輸出路徑格式：

```text
artifacts/<Sol檔名不含副檔名>/<ContractName>.json
```

例如：

```text
artifacts/00_MyState/A.json
```

每個 artifact JSON 包含：

- `contractName`
- `sourceName`
- `abi`
- `bytecode`

## 查看 ABI / bytecode

直接打開 artifact 檔案即可，或用 PowerShell：

```powershell
$j = Get-Content .\artifacts\00_MyState\A.json -Raw | ConvertFrom-Json
$j.abi | ConvertTo-Json -Depth 20
$j.bytecode
```

## 常見問題

- `Compile failed: Contract file not found ...`
  - 請確認檔案存在於 `contracts/`，且檔名正確。

- `Compile failed: Error retrieving binary: Not Found`
  - `--solc` 版本不存在或無法下載，改用可用版本並確認網路可連到 `binaries.soliditylang.org`。
