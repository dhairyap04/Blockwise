import { api, describeFilter } from "./api";
afterEach(() => { delete global.fetch; });
test("backend errors surface to the user", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "Source unavailable" }) });
  await expect(api("/api/buildings")).rejects.toThrow("Source unavailable");
});
test("non-JSON failures explain backend connectivity", async () => {
  global.fetch = jest.fn().mockResolvedValue({ json: async () => { throw new Error("html"); } });
  await expect(api("/api/buildings")).rejects.toThrow("unreadable response");
});
test("descriptions make units and combined conditions explicit", () => {
  expect(describeFilter({ logic: "and", conditions: [{ attribute: "height_m", operator: ">", value: 30 }, { attribute: "assessed_value", operator: "<", value: 500000 }] })).toBe("Height (m) > 30 AND Parcel assessment (CAD) < 500,000");
});
test("successful deletion accepts an empty 204 response",async () => {
  global.fetch=jest.fn().mockResolvedValue({ok:true,status:204});
  await expect(api("/api/projects/1?username=Alex",{method:"DELETE"})).resolves.toBeNull();
});
