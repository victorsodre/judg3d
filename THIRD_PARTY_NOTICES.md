# Third-party notices

The root MIT license applies to judg3d's original code and documentation.
It does not relicense dependencies, sample assets or third-party trademarks.

## Browser bundle

The local UI bundles React 19.2.3, React DOM 19.2.3 and Scheduler 0.27.0
from Meta. Their MIT copyright and permission notice follows in full.
Source: https://github.com/facebook/react

MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Runtime dependencies

The npm package manager installs runtime dependencies with their own license
files. In particular, gltf-validator 2.0.0-dev.3.10 is an independent Khronos
component under Apache-2.0: https://github.com/KhronosGroup/glTF-Validator
Other dependencies retain the notices distributed in their packages.
judg3d adds profile policy, report semantics, isolation and integration; it does
not claim authorship of Khronos validation or Meta's UI runtime.

## Sample assets

The Box and BoxTextured GLBs and the broken Box derivative in fixtures/
originate from Cesium's Khronos sample assets under CC BY 4.0, copyright 2017
Cesium. They are excluded from npm packages. Source revision, hashes and
modifications are recorded in fixtures/README.md. The Cesium logo texture is
part of that fixture and is not a judg3d brand asset.
