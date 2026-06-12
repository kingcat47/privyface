/**
 * Poseidon Hash 유틸리티
 */

import { Field, Poseidon } from "o1js";

/**
 * 문자열을 Poseidon 해시로 변환합니다.
 *
 * @param input 해시할 문자열
 * @returns Poseidon 해시 결과 (문자열)
 */
export async function poseidonHashString(input: string): Promise<string> {
  // 문자열을 Field로 변환
  const field = Field(input);
  // Poseidon 해시 계산
  const hash = Poseidon.hash([field]);
  // 문자열로 반환
  return hash.toString();
}

/**
 * Field 배열을 Poseidon 해시로 변환합니다.
 *
 * @param fields 해시할 Field 배열
 * @returns Poseidon 해시 결과 (문자열)
 */
export function poseidonHashFields(fields: Field[]): string {
  const hash = Poseidon.hash(fields);
  return hash.toString();
}
