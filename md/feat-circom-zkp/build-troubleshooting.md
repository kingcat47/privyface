# circom 빌드 트러블슈팅

> 회로 컴파일 ~ trusted setup 과정에서 발생한 문제들과 해결법

---

## 문제 1: circom 버전 불일치

**증상**
```
Parse error on line 1:
pragma circom 2.0.0;// =====
---------------^
Expecting 'EOF', ...
```

**원인**
npm global로 설치된 `circom`은 버전 `0.5.46` (구버전, v1).
회로 파일은 `pragma circom 2.0.0`을 선언하고 있어서 파싱 자체가 실패함.
circom v1과 v2는 완전히 다른 도구고, npm 패키지 `circom`은 v1임.

**해결**
circom v2는 Rust로 만들어진 별도 바이너리. npm으로 설치 불가. 소스에서 직접 빌드해야 함.

```bash
# Rust가 있어야 함 (rustup default stable로 활성화)
cd C:\Users\leetaegyeom\Desktop
git clone https://github.com/iden3/circom.git circom_src
cd circom_src
cargo build --release
# 빌드 완료 후 바이너리 위치: circom_src/target/release/circom.exe
```

이후 컴파일 시 `circom` 대신 위 경로를 직접 지정해서 사용:
```bash
"C:\Users\leetaegyeom\Desktop\circom_src\target\release\circom" circom/circuits/...
```

---

## 문제 2: circomlib 미설치

**증상**
```
error[P1014]: The file node_modules/circomlib/circuits/poseidon.circom to be included has not been found
```

**원인**
`package.json`에 `circomlibjs`(JS 버전)와 `circom_runtime`은 있었지만
`.circom` 파일을 포함하는 `circomlib`(회로 라이브러리)는 설치되어 있지 않았음.

**해결**
```bash
npm install circomlib
```

---

## 문제 3: include 경로 플래그 `-l` 사용법

**증상**
`circomlib` 설치 후에도 같은 에러 반복:
```
error[P1014]: The file node_modules/circomlib/circuits/poseidon.circom to be included has not been found
```

**원인**
`-l node_modules`로 지정하면 circom이 `node_modules/` 를 include root로 인식해서
`node_modules/circomlib/circuits/poseidon.circom`을 `node_modules/node_modules/circomlib/...`에서 찾음.
회로 파일의 include 경로가 `node_modules/circomlib/...` 형태이므로
include root는 프로젝트 루트(`.`)여야 함.

**해결**
`-l .` (프로젝트 루트)로 지정:
```bash
"C:\Users\leetaegyeom\Desktop\circom_src\target\release\circom" \
  circom/circuits/face-verification.circom \
  --r1cs --wasm --sym \
  -o circom/build/ \
  -l .
```

---

## 최종 성공한 전체 명령어 시퀀스

```bash
# 1. 회로 컴파일
"C:\Users\leetaegyeom\Desktop\circom_src\target\release\circom" \
  circom/circuits/face-verification.circom --r1cs --wasm --sym -o circom/build/ -l .

# 2. Trusted Setup
cd circom/build
npx snarkjs powersoftau new bn128 12 pot12_0000.ptau
echo "아무 엔트로피 문자열" | npx snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="contribution"
npx snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau
npx snarkjs groth16 setup face-verification.r1cs pot12_final.ptau circuit_0000.zkey
echo "아무 엔트로피 문자열" | npx snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey --name="final"
npx snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

# 3. public/circuits로 복사
cp circom/build/face-verification_js/face-verification.wasm public/circuits/face-verification.wasm
cp circom/build/circuit_final.zkey public/circuits/face-verification.zkey
cp circom/build/verification_key.json public/circuits/verification_key.json
```

---

## 컴파일 결과 (참고)

```
template instances: 153
non-linear constraints: 1219
linear constraints: 1524
public inputs: 2
private inputs: 24
wires: 2767
```
