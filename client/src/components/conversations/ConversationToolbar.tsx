import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddCommentIcon from "@mui/icons-material/AddComment";

import { TOP_NAV_HEIGHT } from "../layout/TopNav";
import { ToggleSideBarButton } from "../layout/SideBar";
import { useAddNewConversation } from "../../store/conversations";

function ConversationToolbar() {
  const { addNewConversation } = useAddNewConversation();
  return (
    <div
      style={{
        height: TOP_NAV_HEIGHT,
        padding: "10px 20px 10px 10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <ToggleSideBarButton />
      <Tooltip title="New chat" placement="bottom-start" arrow>
        <IconButton onClick={addNewConversation} sx={{ padding: 0 }}>
          <AddCommentIcon fontSize="medium" sx={{ transform: "scaleX(-1)" }} />
        </IconButton>
      </Tooltip>
    </div>
  );
}

export default ConversationToolbar;
