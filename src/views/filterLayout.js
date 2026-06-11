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
  stackableCardMaxHeight = DEFAULT_STACKABLE_CARD_MAX_HEIGHT,
  options = {}
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
  // The card's "natural uncapped" height — how much vertical space it would
  // occupy if no stackable cap or column constraint applied. Used to bound
  // slack distribution: a card never stretches past this, because beyond it
  // there is no content to fill, only whitespace.
  const getDesiredHeight = (className) => {
    const desired = Math.max(0, Number(desiredCardHeightByClass[className]) || 0);
    return desired > 0 ? desired : getEffectiveHeight(className);
  };
  const resolvedStackableCardMaxHeight =
    toPositiveNumber(stackableCardMaxHeight) || DEFAULT_STACKABLE_CARD_MAX_HEIGHT;
  const scrollableCardByClass =
    options?.scrollableCardByClass && typeof options.scrollableCardByClass === "object"
      ? options.scrollableCardByClass
      : {};
  const desiredCardHeightByClass =
    options?.desiredCardHeightByClass && typeof options.desiredCardHeightByClass === "object"
      ? options.desiredCardHeightByClass
      : {};
  const packingHeightCap =
    toPositiveNumber(options?.categoryMaxHeight) || Number.POSITIVE_INFINITY;
  const allowNonContiguousPacking = Boolean(options?.allowNonContiguousPacking);
  const rowCountByClass =
    options?.rowCountByClass && typeof options.rowCountByClass === "object"
      ? options.rowCountByClass
      : {};
  // Cards with more than this many rows get their own dedicated column.
  // Reasoning: a filter with 30+ values is its own scannable reading lane —
  // stacking it under another card makes the column unwieldy and forces tall
  // scroll regions. Giving it a column keeps both the long list and the rest
  // of the section ergonomic. Infinity disables the behaviour.
  const oversizedRowThreshold =
    Number.isFinite(options?.oversizedRowThreshold) && options.oversizedRowThreshold > 0
      ? options.oversizedRowThreshold
      : Number.POSITIVE_INFINITY;
  const slackDistributionMode =
    typeof options?.slackDistributionMode === "string"
      ? options.slackDistributionMode
      : "proportional";
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
      scrollableCardStretchByClass: {},
    };
  }

  let activeColumnGroups;

  // The oversized-card rule (dedicate a column to any card with rowCount above
  // the threshold) only fires inside the LPT branch. If the caller didn't
  // request LPT but oversized cards exist, force the LPT branch — otherwise
  // long lists stay stacked under shorter siblings, which the rule explicitly
  // wants to avoid. The DP branch can still be selected when there are no
  // oversized cards and the caller passed allowNonContiguousPacking:false.
  const hasOversizedCards = normalizedClassNames.some(
    (c) => (Number(rowCountByClass[c]) || 0) > oversizedRowThreshold
  );
  const useNonContiguousPacking = allowNonContiguousPacking || hasOversizedCards;

  if (useNonContiguousPacking) {
    const k = resolvedMaxColumns;

    // Phase 1: every oversized card gets its own column (capped at k columns
    // total). When more oversized cards exist than columns, the tallest by
    // rowCount get dedicated and the rest fall through to LPT with regulars.
    // Rationale: when the user marks a card as "long enough for its own
    // column," that's a stronger UX signal than preserving a slot for shorter
    // cards. Regulars will be LPT-merged into the dedicated columns below if
    // there's no spare column left.
    const oversizedClasses = normalizedClassNames
      .filter((c) => (Number(rowCountByClass[c]) || 0) > oversizedRowThreshold)
      .sort((a, b) => {
        const rowDelta = (Number(rowCountByClass[b]) || 0) - (Number(rowCountByClass[a]) || 0);
        if (rowDelta !== 0) return rowDelta;
        return normalizedClassNames.indexOf(a) - normalizedClassNames.indexOf(b);
      });
    const regularClasses = normalizedClassNames.filter(
      (c) => (Number(rowCountByClass[c]) || 0) <= oversizedRowThreshold
    );
    const reservedColumnCount = Math.min(oversizedClasses.length, k);
    const dedicatedColumns = oversizedClasses
      .slice(0, reservedColumnCount)
      .map((c) => [c]);
    const overflowOversized = oversizedClasses.slice(reservedColumnCount);
    const remainingForLpt = [...overflowOversized, ...regularClasses];
    const remainingColumnCap = Math.max(0, k - reservedColumnCount);

    // Phase 2: pack the rest. Two scenarios:
    //   a) Spare columns exist → LPT remainders into fresh columns.
    //   b) No spare columns → LPT remainders INTO the dedicated columns
    //      themselves so no card is dropped. The dedicated card still leads
    //      its column visually (we keep natural reading order within columns
    //      afterwards), but it may share with shorter regulars.
    let regularColumns = [];
    if (remainingColumnCap > 0 && remainingForLpt.length > 0) {
      const items = remainingForLpt.map((className) => ({
        className,
        height: getEffectiveHeight(className),
      }));
      items.sort((a, b) => {
        if (Math.abs(a.height - b.height) > LAYOUT_EPSILON) {
          return b.height - a.height;
        }
        return (
          normalizedClassNames.indexOf(a.className) -
          normalizedClassNames.indexOf(b.className)
        );
      });
      const bins = Array.from({ length: remainingColumnCap }, () => ({
        items: [],
        height: 0,
      }));
      items.forEach((item) => {
        let bestBin = bins[0];
        for (let i = 1; i < bins.length; i += 1) {
          if (bins[i].height < bestBin.height - LAYOUT_EPSILON) {
            bestBin = bins[i];
          }
        }
        bestBin.items.push(item.className);
        bestBin.height += item.height + (bestBin.items.length > 1
          ? resolvedNaturalGap
          : 0);
      });
      regularColumns = bins
        .filter((bin) => bin.items.length > 0)
        .map((bin) => bin.items);
    } else if (remainingForLpt.length > 0) {
      // All k columns are already dedicated. LPT remainders into the existing
      // dedicated bins so we don't drop any card.
      const bins = dedicatedColumns.map((column) => ({
        items: column,
        height: getEffectiveHeight(column[0]),
      }));
      const items = remainingForLpt.map((className) => ({
        className,
        height: getEffectiveHeight(className),
      }));
      items.sort((a, b) => {
        if (Math.abs(a.height - b.height) > LAYOUT_EPSILON) {
          return b.height - a.height;
        }
        return (
          normalizedClassNames.indexOf(a.className) -
          normalizedClassNames.indexOf(b.className)
        );
      });
      items.forEach((item) => {
        let bestBin = bins[0];
        for (let i = 1; i < bins.length; i += 1) {
          if (bins[i].height < bestBin.height - LAYOUT_EPSILON) {
            bestBin = bins[i];
          }
        }
        bestBin.items.push(item.className);
        bestBin.height += item.height + resolvedNaturalGap;
      });
      // dedicatedColumns already references the bins[].items arrays — mutated
      // in place by the forEach above.
    }

    activeColumnGroups = [...dedicatedColumns, ...regularColumns].filter(
      (group) => group.length > 0
    );

    const orderIndexByClassName = new Map(
      normalizedClassNames.map((className, index) => [className, index])
    );
    activeColumnGroups = activeColumnGroups.map((group) =>
      [...group].sort(
        (leftClassName, rightClassName) =>
          orderIndexByClassName.get(leftClassName) -
          orderIndexByClassName.get(rightClassName)
      )
    );
    // Sort columns so the left-to-right reading order of columns follows the
    // natural filter order (determined by each column's first element).
    activeColumnGroups.sort(
      (a, b) =>
        orderIndexByClassName.get(a[0]) - orderIndexByClassName.get(b[0])
    );
  } else {
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

    activeColumnGroups = reversedColumnGroups.reverse().filter((group) => group.length > 0);
  }
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

  const scrollableCardStretchByClass = {};
  const distributeSlack = (group, slack) => {
    const scrollableInGroup = group.filter(
      (c) => scrollableCardByClass[c] && getEffectiveHeight(c) > 0
    );
    if (scrollableInGroup.length === 0 || slack <= LAYOUT_EPSILON) return;
    // Each card has a desired height (its natural uncapped size). A card only
    // benefits from stretch up to its desired height — beyond that the extra
    // pixels are dead whitespace inside the card. So we cap every allocation
    // at `desired - current`. Cards already at or beyond their desired height
    // are excluded entirely; if no card has unmet desire, the column's slack
    // is intentionally left unallocated and the column ends at its natural
    // bottom (cleaner Masonry result than padding random cards with whitespace).
    const wantsByClass = {};
    const eligible = [];
    scrollableInGroup.forEach((c) => {
      const want = Math.max(0, getDesiredHeight(c) - getEffectiveHeight(c));
      wantsByClass[c] = want;
      if (want > LAYOUT_EPSILON) eligible.push(c);
    });
    if (eligible.length === 0) return;
    switch (slackDistributionMode) {
      case "none":
        return;
      case "equal": {
        const share = slack / eligible.length;
        eligible.forEach((c) => {
          const give = Math.min(share, wantsByClass[c]);
          scrollableCardStretchByClass[c] = getEffectiveHeight(c) + give;
        });
        return;
      }
      case "tallest": {
        const tallest = eligible.reduce(
          (best, c) =>
            getEffectiveHeight(c) > getEffectiveHeight(best) ? c : best,
          eligible[0]
        );
        const give = Math.min(slack, wantsByClass[tallest]);
        scrollableCardStretchByClass[tallest] = getEffectiveHeight(tallest) + give;
        return;
      }
      case "proportional":
      default: {
        const totalWeight = eligible.reduce(
          (sum, c) => sum + getEffectiveHeight(c),
          0
        );
        eligible.forEach((c) => {
          const share = (getEffectiveHeight(c) / totalWeight) * slack;
          const give = Math.min(share, wantsByClass[c]);
          scrollableCardStretchByClass[c] = getEffectiveHeight(c) + give;
        });
      }
    }
  };

  activeColumnGroups.forEach((group) => {
    if (group.length === 0) return;
    const naturalHeight = group.reduce(
      (sum, className, idx) =>
        sum + getEffectiveHeight(className) + (idx > 0 ? resolvedNaturalGap : 0),
      0
    );
    const slack = alignmentTargetHeight - naturalHeight;
    distributeSlack(group, slack);
  });

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
    scrollableCardStretchByClass,
  };
}

export function buildFilterSectionLayout({
  classNames,
  baseCardHeightByClass: inputBaseCardHeightByClass = {},
  measuredCardHeightByClass: inputMeasuredCardHeightByClass = {},
  desiredCardHeightByClass: inputDesiredCardHeightByClass = {},
  rowCountByClass = {},
  naturalGapPx = 24,
  maxColumns = 3,
  categoryMaxHeight = Number.POSITIVE_INFINITY,
  cardBottomMargin = 0,
  rowHeightEstimate = DEFAULT_ROW_HEIGHT_ESTIMATE,
  cardOverheadEstimate = DEFAULT_CARD_OVERHEAD_ESTIMATE,
  stackableCardMaxHeight = DEFAULT_STACKABLE_CARD_MAX_HEIGHT,
  allowNonContiguousPacking = false,
  slackDistributionMode = "proportional",
  oversizedRowThreshold = Number.POSITIVE_INFINITY,
} = {}) {
  const normalizedClassNames = Array.isArray(classNames) ? classNames : [];
  const measuredCardHeightByClass = {};
  const baseCardHeightByClass = {};
  const scrollableCardByClass = {};
  const desiredCardHeightByClass = {};

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
    scrollableCardByClass[className] =
      measuredHeight > 0 && measuredHeight < stackableCardMaxHeight - LAYOUT_EPSILON
        ? false
        : estimatedHeight > stackableCardMaxHeight + LAYOUT_EPSILON;
    baseCardHeightByClass[className] =
      measuredHeight > 0
        ? measuredHeight
        : configuredBaseHeight > 0
          ? configuredBaseHeight
          : estimatedHeight;
    // Desired (natural uncapped) height: prefer the DOM-measured content
    // height when the caller provides one — that's the chart's actual desired
    // size given current data, and it's the only signal that reflects real
    // row heights, header padding, and the data the chart is actually drawing.
    // Fall back to the row-count estimate before any measurement exists.
    const observedDesired = toPositiveNumber(inputDesiredCardHeightByClass[className]);
    desiredCardHeightByClass[className] =
      observedDesired > 0 ? observedDesired : estimatedHeight;
  });

  const {
    tallestFilterBoxHeight,
    tallestMeasuredFilterBoxHeight,
    columnGroups,
    cardHeightOverrideByClass,
    cardMarginBottomByClass,
    scrollableCardStretchByClass,
  } = buildTallestAlignedLayout(
    normalizedClassNames,
    baseCardHeightByClass,
    measuredCardHeightByClass,
    naturalGapPx,
    maxColumns,
    stackableCardMaxHeight,
    {
      allowNonContiguousPacking,
      categoryMaxHeight,
      scrollableCardByClass,
      desiredCardHeightByClass,
      slackDistributionMode,
      rowCountByClass,
      oversizedRowThreshold,
    }
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
    scrollableCardStretchByClass,
    sectionHeight,
    tallestFilterBoxHeight,
    tallestMeasuredFilterBoxHeight,
  };
}
