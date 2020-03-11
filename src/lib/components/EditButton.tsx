import React from "react";

// Styles
import styles from "../styles/workflowVis.module.css";

import {
    AddWorkflowStepIcon
} from "../../config";

// Types
import {
    CreateAddChildNodeCommand, AddChildNodeCommand
} from "../types/workflowVisTypes";

const noop = () => { };

interface Props {
    createAddChildNodeCommand: CreateAddChildNodeCommand;
    isEmptyBranch?: boolean;
}
const EditButton = ({
    createAddChildNodeCommand: createAddChildNodeCommandProps,
    isEmptyBranch: isEmptyBranchProps = false
}: Props) => {
    const addNodeWithLocation = (
        e: React.MouseEvent,
        mock?: {
            addChildNodeMock: CreateAddChildNodeCommand; isEmptyBranchMock: boolean;
        }
    ): AddChildNodeCommand => {
        const { left, top } = e.currentTarget.getBoundingClientRect();
        let createAddChildNodeCommand: CreateAddChildNodeCommand;
        let isEmptyBranch: boolean;
        if (mock) {
            const { addChildNodeMock, isEmptyBranchMock = false } = mock;
            createAddChildNodeCommand = addChildNodeMock;
            isEmptyBranch = isEmptyBranchMock;
            return createAddChildNodeCommand({ left, top, isEmptyBranch });
        }

        createAddChildNodeCommand = createAddChildNodeCommandProps;
        isEmptyBranch = isEmptyBranchProps;
        return createAddChildNodeCommand({
            left: e.clientX - left, top: e.clientY - top, isEmptyBranch
        });
    };

    return (
        <div className={styles.hoverable} role="button" tabIndex={-1} onClick={addNodeWithLocation} onKeyPress={noop}>
            <span className={styles.circle}>
                <AddWorkflowStepIcon />
            </span>
        </div>

    );
};
export default EditButton;
