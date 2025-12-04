import React from "react";
import Drawer from "@mui/material/Drawer";
import { useTheme } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import Tooltip from "@mui/material/Tooltip";

import { useToggleSideBar } from "../../store/ui";

export const SIDE_BAR_WIDTH = 240;

export const ToggleSideBarButton = () => {
  const { toggleSideBar, sideBarOpen } = useToggleSideBar();
  return (
    <Tooltip
      title={sideBarOpen ? "Collapse conversation list" : "Expand conversation list"}
      placement="bottom-start"
      arrow
    >
      <IconButton onClick={toggleSideBar}>
        <MenuOpenIcon
          fontSize="medium"
          sx={{ transform: sideBarOpen ? "none" : "scaleX(-1)" }}
        />
      </IconButton>
    </Tooltip>
  );
};

function SideBar({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const { sideBarOpen } = useToggleSideBar();
  return (
    <Drawer
      sx={{
        "& .MuiDrawer-paper": {
          width: SIDE_BAR_WIDTH,
          backgroundColor: theme.palette.secondary.main,
        },
      }}
      variant="persistent"
      anchor="left"
      open={sideBarOpen}
    >
      {children}
    </Drawer>
  );
}

export default SideBar;
