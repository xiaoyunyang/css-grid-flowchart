// Libraries
import React from "react";

import {
    Tooltip as UITooltip,
    Menu, MenuItem,
    withStyles
} from "@material-ui/core";

// Types
import { TooltipProps } from "@material-ui/core/Tooltip";
import { type2IconMapping } from "./workflowTypes";

// Components
export const Tooltip = React.forwardRef((
    { children, tooltipContent, placement }: any,
    ref: any
) => (
    <UITooltip
        title={tooltipContent}
        placement={placement}
    >
        <div style={{ marginLeft: "auto", marginRight: "auto" }} ref={ref}>
            { children }
        </div>
    </UITooltip>
));


interface IconClassName {
    [id: string]: string;
}

// TODO: move this into the same file as type2IconMapping
export const iconClassName: IconClassName = {
    pencil: "fas fa-pencil-alt",
    eye: "far fa-eye",
    check: "far fa-check-circle",
    comment: "fas fa-comment",
    inbox: "fas fa-inbox",
    branch: "fas fa-code-branch",
    pause: "fas fa-pause-circle",
    wrench: "fas fa-wrench",
    upload: "fas fa-upload",
    playCircle: "far fa-play-circle",
    vial: "fas fa-vial"
};

const StyledMenu = withStyles({
    paper: {
        border: "1px solid #d3d4d5",
        marginTop: "5px"
    }
})(
    (props: {
      open: boolean;
      anchorEl: any;
      keepMounted: boolean;
      onClose: () => void;
    }) => (
        <Menu
            elevation={0}
            getContentAnchorEl={null}
            anchorOrigin={{
                vertical: "bottom",
                horizontal: "center"
            }}
            transformOrigin={{
                vertical: "top",
                horizontal: "center"
            }}
            {...props}
        />
    )
);


export const Dropdown = (props: any) => <props.component {...props} />;

export const DropdownComponent = ({
    canEdit, canDelete, canManageUsers,
    type, workflowStepUid, workflowUid,
    nextSteps, prevSteps,
    onOpen, onClose, children
}: any) => (
    <WorkflowStepEditMenu
        onClose={onClose}
        onOpen={onOpen}
    >
        {children}
    </WorkflowStepEditMenu>
);

export const WorkflowStepEditMenu = ({
    closeOnClick, onOpen, onClose, children
}: any) => {
    const [anchorEl, setAnchorEl] = React.useState(null);
    const handleClick = (event: any) => {
        setAnchorEl(event.currentTarget);
        onOpen();
    };
    const handleClose = () => {
        setAnchorEl(null);
        onClose();
    };

    return (
        <div>
            <div onClick={handleClick}>
                {children}
            </div>
            <StyledMenu
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                keepMounted
                onClose={handleClose}
            >
                <MenuItem>Edit</MenuItem>
                <MenuItem>Delete</MenuItem>
            </StyledMenu>
        </div>
    );
};

export * from "../defaultUIC";
