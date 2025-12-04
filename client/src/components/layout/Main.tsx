import React from "react";
import Box from "@mui/material/Box";

import { TOP_NAV_HEIGHT } from "./TopNav";
import { SIDE_BAR_WIDTH } from "./SideBar";
import { useToggleSideBar } from "../../store/ui";

export const MAIN_PADDING = 240;

function Main({ children }: { children: React.ReactNode }) {
  const { sideBarOpen } = useToggleSideBar();
  return (
    <Box
      sx={{
        margin: `${TOP_NAV_HEIGHT}px 0 0 ${sideBarOpen ? SIDE_BAR_WIDTH : 0}px`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </Box>
  );
}

export default Main;
