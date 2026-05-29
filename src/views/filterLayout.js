const DEFAULT_ROW_HEIGHT_ESTIMATE = 36;
const DEFAULT_CARD_OVERHEAD_ESTIMATE = 120;
const DEFAULT_STACKABLE_CARD_MAX_HEIGHT = 300;
const LAYOUT_EPSILON = 1e-6;

function toPositiveNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function toNonNegativeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
}

export function estimateCardHeight(
  rowCount = 0,
  rowHeightEstimate = DEFAULT_ROW_HEIGHT_ESTIMATE,
  cardOverheadEstimate = DEFAULT_CARD_OVERHEAD_ESTIMATE
) {
  const safeRowCount = toNonNegativeNumber(rowCount);
  const safeRowHeight =
    toPositiveNumber(rowHeightEstimate) || DEFAULT_ROW_HEIGHT_ESTIMATE;
  const safeCardOverhead =
    toNonNegativeNumber(cardOverheadEstimate) || DEFAULT_CARD_OVERHEAD_ESTIMATE;
  return safeCardOverhead + safeRowCount * safeRowHeight;
}

export function buildTallestAlignedLayout(
  classNames,
  baseCardHeightByClass,
  measuredCardHeightByClass,
  naturalGapPx = 24,
  maxColumns = 3,
  _stackableCardMaxHeight = DEFAULT_STACKABLE_CARD_MAX_HEIGHT
) {
  const normalizedClassNames = Array.isArray(classNames) ? classNames : [];
  const cardHeightOverrideByClass = {};
  const cardMarginBottomByClass = {};
  const resolvedNaturalGap = Math.max(0, Number(naturalGapPx) || 0);
  const getBaseHeight = (className) =>
    Math.max(0, Number(baseCardHeightByClass?.[className]) || 0);
  const getMeasuredHeight = (className) =>
    Math.max(0, Number(measuredCardHeightByClass?.[className]) || 0);
  const getEffectiveHeight = (className) => {
    const measuredHeight = getMeasuredHeight(className);
    if (measuredHeight > 0) {
      return measuredHeight;
    }
    return getBaseHeight(className);
  };
  const resolvedMaxColumns = Math.max(
    1,
    Math.min(
      normalizedClassNames.length || 1,
      Number.isFinite(maxColumns) ? Math.floor(maxColumns) : 3
    )
  );

  if (normalizedClassNames.length === 0) {
    return {
      tallestFilterBoxHeight: 0,
      tallestMeasuredFilterBoxHeight: 0,
      columnGroups: [],
      cardHeightOverrideByClass,
      cardMarginBottomByClass,
    };
  }

  // Change 3: use measured heights (falling back to base) in the DP so that
  // post-measurement re-runs partition on real DOM heights, not just estimates.
  const cumulativeEffectiveHeights = [0];
  normalizedClassNames.forEach((className) => {
    cumulativeEffectiveHeights.push(
      cumulativeEffectiveHeights[cumulativeEffectiveHeights.length - 1] +
        getEffectiveHeight(className)
    );
  });
  const getSegmentHeight = (startIndex, endIndexExclusive) => {
    const itemCount = Math.max(0, endIndexExclusive - startIndex);
    if (itemCount === 0) {
      return 0;
    }
    const sumHeights =
      cumulativeEffectiveHeights[endIndexExclusive] -
      cumulativeEffectiveHeights[startIndex];
    return sumHeights + Math.max(0, itemCount - 1) * resolvedNaturalGap;
  };

  // Change 1: DP cell is a lex tuple {maxH, sumSq}.
  // Comparator: smaller maxH wins; ties broken by smaller sumSq.
  // This replaces the old "splitIndex < currentBestSplit" tiebreak and
  // minimises variance across column heights among equally-tall partitions.
  const n = normalizedClassNames.length;
  const INF = Number.POSITIVE_INFINITY;
  const dp = Array.from({ length: resolvedMaxColumns + 1 }, () =>
    Array.from({ length: n + 1 }, () => ({ maxH: INF, sumSq: INF }))
  );
  const splitAt = Array.from({ length: resolvedMaxColumns + 1 }, () =>
    Array.from({ length: n + 1 }, () => -1)
  );
  dp[0][0] = { maxH: 0, sumSq: 0 };

  // Change 2: run the DP for every k from 1 to resolvedMaxColumns so the
  // outer winner-selection below can pick the column count, not just the split.
  for (let k = 1; k <= resolvedMaxColumns; k += 1) {
    for (let end = k; end <= n; end += 1) {
      for (let split = k - 1; split < end; split += 1) {
        const prev = dp[k - 1][split];
        if (!Number.isFinite(prev.maxH)) {
          continue;
        }

        const h = getSegmentHeight(split, end);
        const candMax = Math.max(prev.maxH, h);
        const candSumSq = prev.sumSq + h * h;
        const best = dp[k][end];

        const isLexBetter =
          candMax < best.maxH - LAYOUT_EPSILON ||
          (Math.abs(candMax - best.maxH) <= LAYOUT_EPSILON &&
            candSumSq < best.sumSq - LAYOUT_EPSILON);

        if (isLexBetter) {
          dp[k][end] = { maxH: candMax, sumSq: candSumSq };
          splitAt[k][end] = split;
        }
      }
    }
  }

  // Change 2: pick the winning column count. Prefer smaller maxH, then
  // smaller sumSq, then smaller k (denser visual) on a full tie.
  let bestK = 1;
  let bestCell = dp[1][n];
  for (let k = 2; k <= resolvedMaxColumns; k += 1) {
    const cell = dp[k][n];
    const isLexBetter =
      cell.maxH < bestCell.maxH - LAYOUT_EPSILON ||
      (Math.abs(cell.maxH - bestCell.maxH) <= LAYOUT_EPSILON &&
        cell.sumSq < bestCell.sumSq - LAYOUT_EPSILON);
    if (isLexBetter) {
      bestK = k;
      bestCell = cell;
    }
  }

  // Reconstruct column groups from the winning k.
  const reversedColumnGroups = [];
  let currentEndIndex = n;
  for (let k = bestK; k >= 1; k -= 1) {
    const split = splitAt[k][currentEndIndex];
    if (split < 0) {
      reversedColumnGroups.push([...normalizedClassNames]);
      currentEndIndex = 0;
      break;
    }

    reversedColumnGroups.push(normalizedClassNames.slice(split, currentEndIndex));
    currentEndIndex = split;
  }

  const activeColumnGroups = reversedColumnGroups.reverse().filter((group) => group.length > 0);
  const activeNaturalHeights = activeColumnGroups.map((group) =>
    group.reduce((sum, className, index) => {
      const cardHeight = getBaseHeight(className);
      return sum + cardHeight + (index > 0 ? resolvedNaturalGap : 0);
    }, 0)
  );
  const activeMeasuredHeights = activeColumnGroups.map((group) =>
    group.reduce((sum, className, index) => {
      const cardHeight = getMeasuredHeight(className);
      return sum + cardHeight + (index > 0 ? resolvedNaturalGap : 0);
    }, 0)
  );
  const tallestFilterBoxHeight =
    activeNaturalHeights.length > 0 ? Math.max(...activeNaturalHeights) : 0;
  const tallestMeasuredFilterBoxHeight =
    activeMeasuredHeights.length > 0 ? Math.max(...activeMeasuredHeights) : 0;
  const alignmentTargetHeight =
    tallestMeasuredFilterBoxHeight > 0
      ? tallestMeasuredFilterBoxHeight
      : tallestFilterBoxHeight;

  activeColumnGroups.forEach((group) => {
    if (group.length === 1) {
      const className = group[0];
      const cardHeight = getEffectiveHeight(className);
      const shouldStretchSoloCard =
        cardHeight > 0 && cardHeight + 0.5 < alignmentTargetHeight;
      if (shouldStretchSoloCard) {
        cardHeightOverrideByClass[className] = alignmentTargetHeight;
      }
      cardMarginBottomByClass[className] = 0;
      return;
    }

    const groupHeight = group.reduce(
      (sum, className) => sum + getEffectiveHeight(className),
      0
    );
    const gapCount = Math.max(1, group.length - 1);
    const gapPx = Math.max(0, (alignmentTargetHeight - groupHeight) / gapCount);

    group.forEach((className, index) => {
      cardMarginBottomByClass[className] =
        index < group.length - 1 ? gapPx : 0;
    });
  });

  return {
    tallestFilterBoxHeight,
    tallestMeasuredFilterBoxHeight,
    columnGroups: activeColumnGroups.map((group) => [...group]),
    cardHeightOverrideByClass,
    cardMarginBottomByClass,
  };
}

export function buildFilterSectionLayout({
  classNames,
  baseCardHeightByClass: inputBaseCardHeightByClass = {},
  measuredCardHeightByClass: inputMeasuredCardHeightByClass = {},
  rowCountByClass = {},
  naturalGapPx = 24,
  maxColumns = 3,
  categoryMaxHeight = Number.POSITIVE_INFINITY,
  cardBottomMargin = 0,
  rowHeightEstimate = DEFAULT_ROW_HEIGHT_ESTIMATE,
  cardOverheadEstimate = DEFAULT_CARD_OVERHEAD_ESTIMATE,
  stackableCardMaxHeight = DEFAULT_STACKABLE_CARD_MAX_HEIGHT,
} = {}) {
  // TODO: Add an optional denser masonry/bin-packing strategy while keeping section height deterministic.
  const normalizedClassNames = Array.isArray(classNames) ? classNames : [];
  const measuredCardHeightByClass = {};
  const baseCardHeightByClass = {};

  normalizedClassNames.forEach((className) => {
    const measuredHeight = toPositiveNumber(inputMeasuredCardHeightByClass[className]);
    const configuredBaseHeight = toPositiveNumber(inputBaseCardHeightByClass[className]);
    const rowCount = toNonNegativeNumber(rowCountByClass[className]);
    const estimatedHeight = estimateCardHeight(
      rowCount,
      rowHeightEstimate,
      cardOverheadEstimate
    );

    measuredCardHeightByClass[className] = measuredHeight;
    baseCardHeightByClass[className] =
      measuredHeight > 0
        ? measuredHeight
        : configuredBaseHeight > 0
          ? configuredBaseHeight
          : estimatedHeight;
  });

  const {
    tallestFilterBoxHeight,
    tallestMeasuredFilterBoxHeight,
    columnGroups,
    cardHeightOverrideByClass,
    cardMarginBottomByClass,
  } = buildTallestAlignedLayout(
    normalizedClassNames,
    baseCardHeightByClass,
    measuredCardHeightByClass,
    naturalGapPx,
    maxColumns,
    stackableCardMaxHeight
  );

  const defaultBaseHeight = estimateCardHeight(
    0,
    rowHeightEstimate,
    cardOverheadEstimate
  );
  const getResolvedCardHeight = (className) => {
    const baseHeight =
      toPositiveNumber(baseCardHeightByClass[className]) || defaultBaseHeight;
    const overrideHeight = toPositiveNumber(cardHeightOverrideByClass[className]);
    return overrideHeight > 0 ? Math.max(baseHeight, overrideHeight) : baseHeight;
  };
  const resolvedCardHeightByClass = Object.fromEntries(
    normalizedClassNames.map((className) => [
      className,
      getResolvedCardHeight(className),
    ])
  );

  const sectionTargetHeight = columnGroups.length
    ? Math.max(
        ...columnGroups.map((group) =>
          group.reduce((sum, className) => {
            const cardHeight =
              toPositiveNumber(resolvedCardHeightByClass[className]) || 0;
            const marginBottom =
              toNonNegativeNumber(cardMarginBottomByClass[className]) || 0;
            return sum + cardHeight + marginBottom;
          }, 0)
        )
      )
    : 0;
  const resolvedCategoryMaxHeight =
    toPositiveNumber(categoryMaxHeight) || Number.POSITIVE_INFINITY;
  const resolvedCardBottomMargin = toNonNegativeNumber(cardBottomMargin);
  const sectionHeight = normalizedClassNames.length
    ? Math.min(
        resolvedCategoryMaxHeight,
        sectionTargetHeight + resolvedCardBottomMargin
      )
    : 0;

  return {
    baseCardHeightByClass,
    measuredCardHeightByClass,
    resolvedCardHeightByClass,
    columnGroups,
    cardHeightOverrideByClass,
    cardMarginBottomByClass,
    sectionHeight,
    tallestFilterBoxHeight,
    tallestMeasuredFilterBoxHeight,
  };
}
