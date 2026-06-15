import {
  buildChildChartData,
  buildRolledUpChartData,
  buildRollupInstanceMap,
  hasRollup,
  isExpandable,
  parseLabel,
  resolveRollupSelections,
} from "../rollup";

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

  it("orders rolled-up overall stages by clinical progression, not alphabetically", () => {
    const rows = [
      { label: "Stage IV", patientIds: ["1"] },
      { label: "Stage 0", patientIds: ["2"] },
      { label: "Stage II", patientIds: ["3"] },
      { label: "Stage III", patientIds: ["4"] },
    ];

    const rolled = buildRolledUpChartData(rows, "Stage");

    expect(rolled.map((row) => row.label)).toEqual(["Stage 0", "Stage II", "Stage III", "Stage IV"]);
  });

  it("orders sub-stage children A/B/C after the bare parent", () => {
    const rows = [
      { label: "Stage IIB", patientIds: ["1"] },
      { label: "Stage IIA", patientIds: ["2"] },
      { label: "Stage II", patientIds: ["3"] },
    ];

    const instanceMap = buildRollupInstanceMap(rows, "Stage");
    expect(instanceMap["Stage II"]).toEqual(["Stage II", "Stage IIA", "Stage IIB"]);

    const children = buildChildChartData(rows, "Stage", "Stage II");
    expect(children.map((row) => row.displayLabel)).toEqual(["Stage II", "Stage IIA", "Stage IIB"]);
  });

  it("treats 'Stage Is' (in situ) as its own parent", () => {
    expect(parseLabel("Stage Is", "Stage")).toMatchObject({ parent: "Stage Is", child: null });
  });
});

describe("rollup Grade", () => {
  const rows = [
    { label: "Grade1", patientIds: ["1"] },
    { label: "Grade3", patientIds: ["2"] },
    { label: "Grade3a", patientIds: ["3"] },
    { label: "Grade2", patientIds: ["4"] },
  ];

  it("rolls grade rows into numeric parents in ascending order", () => {
    const rolled = buildRolledUpChartData(rows, "Grade");

    expect(rolled.map((row) => row.label)).toEqual(["G1", "G2", "G3"]);

    const g3 = rolled.find((row) => row.label === "G3");
    expect(g3).toMatchObject({ value: 2, _expandable: true, _isRolledUp: true });
    expect(rolled.find((row) => row.label === "G1")._expandable).toBe(false);
  });

  it("orders sub-grade letter children after the bare grade", () => {
    const instanceMap = buildRollupInstanceMap(rows, "Grade");
    expect(instanceMap.G3).toEqual(["Grade3", "Grade3a"]);

    const children = buildChildChartData(rows, "Grade", "G3");
    expect(children.map((row) => row.displayLabel)).toEqual(["G3", "G3a"]);
  });

  it("parses GX and Gleason as distinct parents ranked after numeric grades", () => {
    const mixedRows = [
      { label: "Grade2", patientIds: ["1"] },
      { label: "GX", patientIds: ["2"] },
      { label: "Gleason7", patientIds: ["3"] },
    ];

    const rolled = buildRolledUpChartData(mixedRows, "Grade");
    expect(rolled.map((row) => row.label)).toEqual(["G2", "GX", "Gleason"]);
  });
});

describe("rollup Behavior", () => {
  const rows = [
    { label: "Benign", patientIds: ["4"] },
    { label: "Malignant", patientIds: ["1", "2"] },
    { label: "Invasive", patientIds: ["3"] },
  ];

  it("rolls behavior rows into clinical-progression parents", () => {
    const rolled = buildRolledUpChartData(rows, "Behavior");

    expect(rolled.map((row) => row.label)).toEqual(["Benign", "Malignant"]);

    const malignant = rolled.find((row) => row.label === "Malignant");
    // Invasive is collapsed under Malignant; union of patient sets => 3.
    expect(malignant).toMatchObject({ value: 3, _expandable: true });
    expect(rolled.find((row) => row.label === "Benign")._expandable).toBe(false);
  });

  it("orders the bare Malignant before its Invasive/metastatic children", () => {
    const instanceMap = buildRollupInstanceMap(rows, "Behavior");
    expect(instanceMap.Malignant).toEqual(["Malignant", "Invasive"]);

    const children = buildChildChartData(rows, "Behavior", "Malignant");
    expect(children.map((row) => row.displayLabel)).toEqual(["Malignant", "Invasive"]);
  });
});

describe("rollup helpers", () => {
  it("reports which classes have rollup rules", () => {
    expect(hasRollup("Grade")).toBe(true);
    expect(hasRollup("Behavior")).toBe(true);
    expect(hasRollup("Stage")).toBe(true);
    expect(hasRollup("NOT_A_ROLLUP_CLASS")).toBe(false);
  });

  it("expands a parent selection to its raw child instances", () => {
    const rows = [
      { label: "Grade3", patientIds: ["1"] },
      { label: "Grade3a", patientIds: ["2"] },
    ];
    const instanceMap = buildRollupInstanceMap(rows, "Grade");

    expect(resolveRollupSelections(["G3"], "Grade", instanceMap)).toEqual(["Grade3", "Grade3a"]);
    // A value that is not a rollup parent passes through unchanged.
    expect(resolveRollupSelections(["G1"], "Grade", instanceMap)).toEqual(["G1"]);
  });

  it("reports a parent as expandable only when it has more than one child", () => {
    const rows = [
      { label: "Grade1", patientIds: ["1"] },
      { label: "Grade3", patientIds: ["2"] },
      { label: "Grade3a", patientIds: ["3"] },
    ];

    expect(isExpandable(rows, "Grade", "G3")).toBe(true);
    expect(isExpandable(rows, "Grade", "G1")).toBe(false);
  });
});
