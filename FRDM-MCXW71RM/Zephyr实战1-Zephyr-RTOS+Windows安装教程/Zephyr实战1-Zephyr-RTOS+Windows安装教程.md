
-------------2025-12-26-------------
# B站-视频教程：
https://www.bilibili.com/video/BV1jwBvBpEwN/?vd_source=9ebd187ccc98c26d8c32c09c0ffa5319


# Zephyr-Windows系统安装教程
Zephyr官方文档：
`https://docs.zephyrproject.org/latest/develop/getting_started/index.html#select-and-update-os`

GitHub地址：
`https://github.com/zephyrproject-rtos/zephyr`

## 1. 如何判断是否是管理员 + 安装必要依赖
```
if (([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { "管理员" } else { "非管理员" }
```

- 建议使用Windows 10 系统。
- 使用` Windows PowerShell `.


安装必要工具：
```powershell
查看 winget 版本
winget --version

winget install Kitware.CMake Ninja-build.Ninja oss-winget.gperf Python.Python.3.12 Git.Git oss-winget.dtc wget 7zip.7zip
```


```
Devicetree compiler

下载地址:
https://github.com/dgibson/dtc/tags

依据Zephyr官网建议进行对应版本安装
```

#### `DTC` 安装视频教程

https://www.bilibili.com/video/BV16TFez1EJT/?vd_source=9ebd187ccc98c26d8c32c09c0ffa5319

```
关于 dtc 相关安装部分，可查看我的--B站教程：
https://www.bilibili.com/video/BV16TFez1EJT/?vd_source=9ebd187ccc98c26d8c32c09c0ffa5319
```

---


```powershell
验证 dtc 安装是否成功
dtc --version

Get-Command dtc
```

#### dtc 安装目录
```powershell
PS C:\Users\Administrator> dtc --version
Version: DTC 1.6.1


PS C:\Users\Administrator> Get-Command dtc
CommandType     Name                                               Version    Source                                 
-----------     ----                                               -------    ------                                 
Application     dtc.exe                                            1.0.0.0    C:\ProgramData\chocolatey\bin\dtc.exe  

PS C:\Users\Administrator> 
```

## 2. 创建根目录
```
cd D:\Zephyr
创建虚拟环境
python -m venv zephyrproject\.venv

```

## 3. 激活虚拟环境
```
cd D:\Zephyr
zephyrproject\.venv\Scripts\Activate.ps1

pip install west

cd D:\Zephyr\zephyrproject
Remove-Item -Recurse -Force .west
```

## 4. 初始化安装
```
west init -m https://github.com/zephyrproject-rtos/zephyr --mr main
west update
```

## 5. 导出 Zephyr CMake 包 。这样 CMake 就可以自动加载构建 Zephyr 应用程序所需的样板代码。
`west zephyr-export`

输出日志：
```
(.venv) PS D:\Zephyr\zephyrproject> west zephyr-export
Zephyr (D:/Zephyr/zephyrproject/zephyr/share/zephyr-package/cmake)
has been added to the user package registry in:
HKEY_CURRENT_USER\Software\Kitware\CMake\Packages\Zephyr

ZephyrUnittest (D:/Zephyr/zephyrproject/zephyr/share/zephyrunittest-package/cmake)
has been added to the user package registry in:
HKEY_CURRENT_USER\Software\Kitware\CMake\Packages\ZephyrUnittest

(.venv) PS D:\Zephyr\zephyrproject>
```



## 6. 使用 west packages 安装 Python 依赖项。
```
python -m pip install @((west packages pip) -split ' ')
```

## 7. 使用 west sdk install 安装 Zephyr SDK。
```
cd D:\Zephyr\zephyrproject\zephyr
west sdk install
```

### 7.1 报错（调用Github次数太多，被限制）
```
(.venv) PS D:\Zephyr\zephyrproject\zephyr>
>> west sdk install
Found 'D:\Zephyr\zephyrproject\zephyr\SDK_VERSION', installing version 0.17.4.
Fetching Zephyr SDK list...
fetch_releases API rate limit exceeded. Try executing install script with --personal-access-token argument or use a .netrc file
Traceback (most recent call last):
  File "<frozen runpy>", line 198, in _run_module_as_main
  File "<frozen runpy>", line 88, in _run_code
  File "D:\Zephyr\zephyrproject\.venv\Scripts\west.exe\__main__.py", line 7, in <module>
  File "D:\Zephyr\zephyrproject\.venv\Lib\site-packages\west\app\main.py", line 1199, in main
    app.run(argv or sys.argv[1:])
  File "D:\Zephyr\zephyrproject\.venv\Lib\site-packages\west\app\main.py", line 278, in run
    self.run_command(argv, early_args)
  File "D:\Zephyr\zephyrproject\.venv\Lib\site-packages\west\app\main.py", line 584, in run_command
    self.run_extension(args.command, argv)
  File "D:\Zephyr\zephyrproject\.venv\Lib\site-packages\west\app\main.py", line 739, in run_extension
    self.cmd.run(args, unknown, self.topdir, manifest=self.manifest,
  File "D:\Zephyr\zephyrproject\.venv\Lib\site-packages\west\commands.py", line 200, in run
    self.do_run(args, unknown)
  File "D:\Zephyr\zephyrproject\zephyr\scripts\west_commands\sdk.py", line 617, in do_run
    self.install_sdk(args, user_args)
  File "D:\Zephyr\zephyrproject\zephyr\scripts\west_commands\sdk.py", line 440, in install_sdk
    releases = self.fetch_releases(args.api_url, req_headers)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Zephyr\zephyrproject\zephyr\scripts\west_commands\sdk.py", line 253, in fetch_releases
    raise Exception(f"Failed to fetch: {resp.status_code}, {resp.text}")
Exception: Failed to fetch: 403, {"message":"API rate limit exceeded for 13.208.168.179. (But here's the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)","documentation_url":"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"}

(.venv) PS D:\Zephyr\zephyrproject\zephyr>
```

### 7.2 使用Token方式修复(替换自己的`Github token`哈)
- （调用Github次数太多，被限制）
- 这里大家申请自己的`Github token`哈，替换成自己申请的`token`哦~
```
# 制定安装目录，安装到 D:\Zephyr\
west sdk install -d D:\Zephyr\zephyr-sdk --personal-access-token ghp_rTUYD8xxxxxx12

# 以下是：默认安装位置
west sdk install --personal-access-token YOUR_TOKEN_HERE
west sdk install --personal-access-token ghp_rTUYJMD8MVeabhwDjiSMgqfG1yaB2kuD4N
```

日志：
```
(.venv) PS D:\Zephyr\zephyrproject\zephyr> west sdk install --personal-access-token ghp_rTUYD8MVeaFObhjiSMgqfG1yaB2kuD4N
Found 'D:\Zephyr\zephyrproject\zephyr\SDK_VERSION', installing version 0.17.4.
Fetching Zephyr SDK list...
Fetching sha256...
Downloading https://github.com/zephyrproject-rtos/sdk-ng/releases/download/v0.17.4/zephyr-sdk-0.17.4_windows-x86_64_minimal.7z...
zephyr-sdk-0.17.4_windows-x86_64_minimal.7z: 100%|#######################################|   4.71k ?/s   [00:00]

Downloaded: C:\Users\Administrator\tmp52qfbi5y\zephyr-sdk-0.17.4_windows-x86_64_minimal.7z
Extract: C:\Users\Administrator\tmp52qfbi5y\zephyr-sdk-0.17.4_windows-x86_64_minimal.7z
INFO patool: Extracting C:\Users\Administrator\tmp52qfbi5y\zephyr-sdk-0.17.4_windows-x86_64_minimal.7z ...
INFO patool: could not find a 'file' executable, falling back to guess mime type by file extension
INFO patool: running C:\ProgramData\chocolatey\bin\7z.EXE x -aou -oC:\Users\Administrator\tmp52qfbi5y -- C:\Users\Administrator\tmp52qfbi5y\zephyr-sdk-0.17.4_windows-x86_64_minimal.7z
INFO patool: ... C:\Users\Administrator\tmp52qfbi5y\zephyr-sdk-0.17.4_windows-x86_64_minimal.7z extracted to `C:\Users\Administrator\tmp52qfbi5y'.
Move: C:\Users\Administrator\tmp52qfbi5y\zephyr-sdk-0.17.4 to C:\Users\Administrator\zephyr-sdk-0.17.4.
Zephyr SDK 0.17.4 Setup

Registering Zephyr SDK CMake package ...
Zephyr-sdk (C:/Users/Administrator/zephyr-sdk-0.17.4/cmake)
has been added to the user package registry in:
HKEY_CURRENT_USER\Software\Kitware\CMake\Packages\Zephyr-sdk


All done.
Zephyr SDK 0.17.4 Setup

Installing 'aarch64-zephyr-elf' toolchain ...
```

## 8. 工具链安安装
 `west sdk install --personal-access-token ghp_rTUYD8MVeaFObhjiSMgqfG1yaB2kuD4N`

### 8.1 报错日志：
```

Folders: 259
Files: 2066
Size:       331222996
Compressed: 47528429
Installing 'arc-zephyr-elf' toolchain ...
ERROR: Toolchain download failed
FATAL ERROR: command "C:\Users\Administrator\zephyr-sdk-0.17.4\setup.cmd /t all /h" failed
(.venv) PS D:\Zephyr\zephyrproject\zephyr>
```

### 8.2 修复：
#### 只安装 ARM 工具链（RA6E2 所需）
```
west sdk install --toolchain arm-zephyr-eabi --personal-access-token ghp_rTUYJMD8MVeaFbhwDjiSMgqfG1yaB2kuD4N

```

#### 注：`arm-zephyr-eabi`专为 ARM 架构的嵌入式设备（Cortex-M / Cortex-R） 编译 Zephyr 应用。
  - 支持所有 ARMv6-M、ARMv7-M、ARMv8-M 架构的处理器。

成功日志：
```
(.venv) PS D:\Zephyr\zephyrproject\zephyr> west sdk install --toolchain arm-zephyr-eabi --personal-access-token ghp_rTUYJMD8MVeObhwDjiSMgqfG1yaB2kuD4N
Found 'D:\Zephyr\zephyrproject\zephyr\SDK_VERSION', installing version 0.17.4.
Fetching Zephyr SDK list...
Zephyr SDK version 0.17.4 is already installed at C:\Users\Administrator\zephyr-sdk-0.17.4. Using it.
Zephyr SDK 0.17.4 Setup

Registering Zephyr SDK CMake package ...
Zephyr-sdk (C:/Users/Administrator/zephyr-sdk-0.17.4/cmake)
has been added to the user package registry in:
HKEY_CURRENT_USER\Software\Kitware\CMake\Packages\Zephyr-sdk


All done.
Zephyr SDK 0.17.4 Setup

Installing 'arm-zephyr-eabi' toolchain ...
toolchain_windows-x86_64_arm- 100%[=================================================>]  81.87M  1.12MB/s    in 2m 44s

7-Zip 25.01 (x64) : Copyright (c) 1999-2025 Igor Pavlov : 2025-08-03

Scanning the drive for archives:
1 file, 85844046 bytes (82 MiB)

Extracting archive: toolchain_windows-x86_64_arm-zephyr-eabi.7z
--
Path = toolchain_windows-x86_64_arm-zephyr-eabi.7z
Type = 7z
Physical Size = 85844046
Headers Size = 36310
Method = LZMA2:24 BCJ
Solid = +
Blocks = 2

Everything is Ok

Folders: 521
Files: 4355
Size:       1162592180
Compressed: 85844046
Installing host tools ...
SKIPPED: Windows host tools are not available yet.

All done.
```


## 9. 可用于获取 Zephyr 支持的所有开发板列表。
`west boards `


### 9.1 搜索方法1
`west boards | Where-Object { $_ -like "*关键词*" }`

```
(.venv) PS D:\Zephyr\zephyrproject\zephyr> west boards | Where-Object { $_ -like "*fpb*" }
fpb_ra4e1
fpb_ra6e1
fpb_ra6e2
fpb_rx261
```

### 9.2 搜索方法2：忽略大小写
`
west boards | Select-String -Pattern "RA6E2" -CaseSensitive:$false
`

```
(.venv) PS D:\Zephyr\zephyrproject\zephyr>
>> west boards | Select-String -Pattern "RA6E2" -CaseSensitive:$false

ek_ra6e2
fpb_ra6e2

```

## 10. 列举支持的开发板数量
```
(.venv) PS D:\Zephyr\zephyrproject\zephyr> (west boards | Measure-Object).Count
921
```

`west build -p always -b <your-board-name> samples\basic\blinky`

```
-p always 选项强制执行全新构建，建议新用户使用。
-b <your-board-name>替换你的开发板名称。
```

---
---

至此，Zephyr 安装完成。


## 11. 查看 Zephyr 仓库版本
### 11.1 查看git版本
```
git -C zephyr describe --tags
git -C zephyr describe --tags --abbrev=0
```
输出：
```
PS D:\Zephyr\zephyrproject> git -C zephyr describe --tags
v4.3.0-2928-g23354f3cad3
```

### 11.2 查看 West：版本
```
PS D:\Zephyr> zephyrproject\.venv\Scripts\Activate.ps1
(.venv) PS D:\Zephyr> west --version
West version: v1.5.0
```

### 11.3 当前 Zephyr SDK 版本：
```
Found 'D:\Zephyr\zephyrproject\zephyr\SDK_VERSION', installing version 0.17.4.
```

在`PowerShell`中输出：
`type D:\Zephyr\zephyrproject\zephyr\SDK_VERSION`



### 11.4 查看当前用户
```
(.venv) PS D:\Zephyr\zephyrproject\zephyr> whoami
desktop-cbifivc\administrator
```


## 12. 构建 Blinky 样例
```
(.venv) PS D:\Zephyr\zephyrproject\zephyr> west build -p always -b fpb_ra6e2 samples\basic\blinky
```

日志输出：
```
(.venv) PS D:\Zephyr\zephyrproject\zephyr> west build -p always -b fpb_ra6e2 samples\basic\blinky
-- west build: generating a build system
Loading Zephyr default modules (Zephyr base).
-- Application: D:/Zephyr/zephyrproject/zephyr/samples/basic/blinky
-- CMake version: 4.2.1
-- Found Python3: D:/Zephyr/zephyrproject/.venv/Scripts/python.exe (found suitable version "3.11.9", minimum required is "3.10") found components: Interpreter
-- Cache files will be written to: D:/Zephyr/zephyrproject/zephyr/.cache
-- Zephyr version: 4.3.99 (D:/Zephyr/zephyrproject/zephyr)
-- Found west (found suitable version "1.5.0", minimum required is "0.14.0")
-- Board: fpb_ra6e2, qualifiers: r7fa6e2bb3cfm
-- ZEPHYR_TOOLCHAIN_VARIANT not set, trying to locate Zephyr SDK
-- Found host-tools: zephyr 0.17.4 (C:/Users/Administrator/zephyr-sdk-0.17.4)
-- Found toolchain: zephyr 0.17.4 (C:/Users/Administrator/zephyr-sdk-0.17.4)
-- Found Dtc: C:/ProgramData/chocolatey/bin/dtc.exe (found suitable version "1.6.1", minimum required is "1.4.6")
-- Found BOARD.dts: D:/Zephyr/zephyrproject/zephyr/boards/renesas/fpb_ra6e2/fpb_ra6e2.dts
-- Generated zephyr.dts: D:/Zephyr/zephyrproject/zephyr/build/zephyr/zephyr.dts
-- Generated pickled edt: D:/Zephyr/zephyrproject/zephyr/build/zephyr/edt.pickle
-- Generated devicetree_generated.h: D:/Zephyr/zephyrproject/zephyr/build/zephyr/include/generated/zephyr/devicetree_generated.h
D:/Zephyr/zephyrproject/zephyr/build/zephyr/zephyr.dts:818.14-821.5: Warning (simple_bus_reg): /soc/trng: missing or empty reg/ranges property
Parsing D:/Zephyr/zephyrproject/zephyr/Kconfig
Loaded configuration 'D:/Zephyr/zephyrproject/zephyr/boards/renesas/fpb_ra6e2/fpb_ra6e2_defconfig'
Merged configuration 'D:/Zephyr/zephyrproject/zephyr/samples/basic/blinky/prj.conf'
Configuration saved to 'D:/Zephyr/zephyrproject/zephyr/build/zephyr/.config'
Kconfig header saved to 'D:/Zephyr/zephyrproject/zephyr/build/zephyr/include/generated/zephyr/autoconf.h'
-- Found GnuLd: c:/users/administrator/zephyr-sdk-0.17.4/arm-zephyr-eabi/arm-zephyr-eabi/bin/ld.bfd.exe (found version "2.38")
-- The C compiler identification is GNU 12.2.0
-- The CXX compiler identification is GNU 12.2.0
-- The ASM compiler identification is GNU
-- Found assembler: C:/Users/Administrator/zephyr-sdk-0.17.4/arm-zephyr-eabi/bin/arm-zephyr-eabi-gcc.exe
-- Using ccache: C:/Strawberry/c/bin/ccache.exe
-- Found gen_kobject_list: D:/Zephyr/zephyrproject/zephyr/scripts/build/gen_kobject_list.py
-- Configuring done (110.0s)
-- Generating done (1.7s)
-- Build files have been written to: D:/Zephyr/zephyrproject/zephyr/build
-- west build: building application
[1/143] Generating include/generated/zephyr/version.h
-- Zephyr version: 4.3.99 (D:/Zephyr/zephyrproject/zephyr), build: v4.3.0-2928-g23354f3cad32
[143/143] Linking C executable zephyr\zephyr.elf
Memory region         Used Size  Region Size  %age Used
           FLASH:       22400 B       256 KB      8.54%
             RAM:        4832 B        40 KB     11.80%
 OFS_OFS0_MEMORY:           4 B          4 B    100.00%
 OFS_OSIS_MEMORY:          16 B         16 B    100.00%
OFS_OFS1_SEC_MEMORY:           4 B          4 B    100.00%
OFS_BPS_SEC_MEMORY:           4 B          4 B    100.00%
OFS_PBPS_SEC_MEMORY:           4 B          4 B    100.00%
        IDT_LIST:          0 GB        32 KB      0.00%
Generating files from D:/Zephyr/zephyrproject/zephyr/build/zephyr/zephyr.elf for board: fpb_ra6e2
(.venv) PS D:\Zephyr\zephyrproject\zephyr>
```




## 13. 烧录程序
通过 USB 接口连接开发板，
```
west flash
```

### 13.1 失败情况输出日志：
因没有连接开发板，直接烧录，

```
(.venv) PS D:\Zephyr\zephyrproject\zephyr> west flash
-- west flash: rebuilding
ninja: no work to do.
-- west flash: using runner jlink
-- runners.jlink: reset after flashing requested
-- runners.jlink: JLink version: 8.92
-- runners.jlink: Flashing file: D:\Zephyr\zephyrproject\zephyr\build\zephyr\zephyr.hex
FATAL ERROR: command exited with status 1: 'C:\Program Files\SEGGER\JLink\JLink.exe' -nogui 1 -if swd -speed auto -device R7FA6E2BB -CommanderScript 'C:\Users\Administrator\AppData\Local\Temp\tmpaq6zsh3yjlink\runner.jlink' -nogui 1
(.venv) PS D:\Zephyr\zephyrproject\zephyr>
```

### 13.2 烧录成功日志：

```
(.venv) PS D:\Zephyr\zephyrproject\zephyr> west flash
-- west flash: rebuilding
ninja: no work to do.
-- west flash: using runner jlink
-- runners.jlink: reset after flashing requested
-- runners.jlink: JLink version: 8.92
-- runners.jlink: Flashing file: D:\Zephyr\zephyrproject\zephyr\build\zephyr\zephyr.hex

```
