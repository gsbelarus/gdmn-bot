import { normalizeStr } from '../util/utils';

describe("utils", () => {
  it("normalizeStr", () => {
    expect(normalizeStr('берёзовский мясо-комбинат')).toEqual('березовский мясокомбинат');
    expect(normalizeStr('слонимский мясокомбинат')).toEqual('слонимский мясокомбинат');
    expect(normalizeStr('ОАО,,Слонимский мясокомбинат,,')).toEqual('слонимский мясокомбинат');
  });
});