import { buildChildChartData, buildRolledUpChartData, buildRollupInstanceMap } from "../rollup";

describe("rollup Stage", () => {
  it("rolls up overall Stage rows using display labels and preserves raw instance keys", () => {
    const rows = [
      { label: "StageI", displayLabel: "Stage I", value: 100, patientIds: ["1", "2"] },
      { label: "StageIA", displayLabel: "Stage IA", value: 90, patientIds: ["3"] },
      { label: "StageIB", displayLabel: "Stage IB", value: 80, patientIds: ["4"] },
      { label: "StageIIA", displayLabel: "Stage IIA", value: 70, patientIds: ["5"] },
    ];

    const rolled = buildRolledUpChartData(rows, "Stage");

    expect(rolled.map((row) => row.label)).toEqual(["Stage I", "Stage II"]);

    const stageIRow = rolled.find((row) => row.label === "Stage I");
    const stageIIRow = rolled.find((row) => row.label === "Stage II");

    expect(stageIRow).toMatchObject({
      displayLabel: "Stage I",
      value: 4,
      _expandable: true,
      _isRolledUp: true,
    });
    expect(stageIIRow).toMatchObject({
      displayLabel: "Stage II",
      value: 1,
      _expandable: false,
      _isRolledUp: true,
    });

    const instanceMap = buildRollupInstanceMap(rows, "Stage");
    expect(instanceMap["Stage I"]).toEqual(["StageI", "StageIA", "StageIB"]);
    expect(instanceMap["Stage II"]).toEqual(["StageIIA"]);

    const children = buildChildChartData(rows, "Stage", "Stage I");
    expect(children.map((row) => row.label)).toEqual(["StageI", "StageIA", "StageIB"]);
    expect(children.map((row) => row.displayLabel)).toEqual(["Stage I", "Stage IA", "Stage IB"]);
  });
});
