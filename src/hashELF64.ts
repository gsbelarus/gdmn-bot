/*
function HashELF64(const aBuf; aBufSize: Integer): Int64;
type
  TByteArray = array[0..MaxInt - 1] of Byte;
var
  i: Integer;
  x: Int64;
begin
  Result := 0;
  for i := 0 to aBufSize - 1 do
  begin
    Result := (Result shl 4) + TByteArray(aBuf)[i];
    x := Result and $F000000000000000;
    if (x <> 0) then
      Result := Result xor (x shr 56);
    Result := Result and (not x);
  end;
end;
*/

export const hashELF64 = (s: string) => {
  let res = 0n;
  for (const c of [...s]) {
    res = (res << 4n) + BigInt(c.charCodeAt(0));
    const x = res & 0xF000000000000000n;
    if (x !== 0n) {
      res = res ^ (x >> 56n);
    }
    res = res & (~x);
  }
  return res;
};
