import React from "react";
import { Box, Link as MuiLink } from "@mui/material";
import { getAnchorId } from "../../utils/dataProcessing";

function SectionJumpLinks({ sectionKey, values, onJump }) {
  if (!values || values.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        columnGap: 1,
        rowGap: 0.5,
      }}
    >
      {values.map((value) => {
        const label = String(value);
        const targetId = getAnchorId(sectionKey, label);

        return (
          <MuiLink
            key={`${sectionKey}:${label}`}
            href={`#${targetId}`}
            underline="hover"
            variant="body2"
            sx={{ color: "text.secondary" }}
            onClick={onJump(sectionKey, label)}
          >
            {label}
          </MuiLink>
        );
      })}
    </Box>
  );
}

export default SectionJumpLinks;
