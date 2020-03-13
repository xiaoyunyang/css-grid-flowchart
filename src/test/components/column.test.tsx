import React from "react";
import { configure, shallow } from "enzyme";
import Adapter from "enzyme-adapter-react-16";

// Components
import Column from "../../lib/components/Column";
import ForkStep from "../../lib/components/ForkStep";
import WorkflowStep from "../../lib/components/WorkflowStep";
import Connector from "../../lib/components/Connector";

// Types
import { encodedNodeType } from "../../config";
import { ConnectorTypeT } from "../../lib/types";

configure({ adapter: new Adapter() });

describe("Column Spec", () => {
    let column: any;
    const colEntries = [
        {
            matrixEntry: "ba322565b1bf",
            tile: { id: "ba322565b1bf", name: "D", type: encodedNodeType.fork }
        },
        {
            matrixEntry: "09e6110fda58",
            tile: { id: "09e6110fda58", name: encodedNodeType[2], type: encodedNodeType[2] }
        },
        {
            matrixEntry: "box|empty|0,1",
            tile: {
                id: "box|empty", name: "empty", containerName: "connectorContainerBox", type: ConnectorTypeT.BOX_CONNECTOR
            }
        },
        {
            matrixEntry: "diamond|lineHoriz|3,3|2,2",
            tile: {
                id: "diamond|lineHoriz", name: "lineHoriz", containerName: "connectorContainerDiamond", type: ConnectorTypeT.DIAMOND_CONNECTOR
            }
        },
        {
            matrixEntry: "diamond|arrowRight|3,4|2,4",
            tile: {
                id: "diamond|arrowRight", name: "arrowRight", containerName: "connectorContainerDiamond", type: ConnectorTypeT.DIAMOND_CONNECTOR
            }
        }
    ];

    const createAddChildNodeCommand = ({ isEmptyBranch }: { isEmptyBranch: boolean }) => { };

    const addNodeParams = (
        {
            ownCoord, parentCoord
        }: {
            ownCoord: string | undefined;
            parentCoord: string | undefined;
        }
    ) => createAddChildNodeCommand;

    let props: any;

    beforeEach(() => {
        props = {
            colEntries,
            colNum: 0,
            editMode: false,
            addNodeParams
        };

        column = shallow(<Column {...props} />);
    });

    describe("render", () => {
        it("renders decision step", () => {
            const forkStep = column.find(ForkStep);
            expect(forkStep).toHaveLength(1);
            expect(column.at(0).childAt(0)).toEqual(forkStep);
        });
        it("renders workflow step", () => {
            const workflowStep = column.find(WorkflowStep);
            expect(workflowStep).toHaveLength(1);
            expect(column.at(1).childAt(0)).toEqual(workflowStep);
        });
        it("renders connector", () => {
            const connectors = column.find(Connector);

            const empty = column.find({ id: "box|empty" });
            const lineHoriz = column.find({ id: "diamond|lineHoriz" });
            const arrowRight = column.find({ id: "diamond|arrowRight" });
            expect(connectors).toHaveLength(3);
            expect(empty).toHaveLength(1);
            expect(lineHoriz).toHaveLength(1);
            expect(arrowRight).toHaveLength(1);
            expect(column.at(2).childAt(0)).toEqual(empty);
            expect(column.at(3).childAt(0)).toEqual(lineHoriz);
            expect(column.at(4).childAt(0)).toEqual(arrowRight);
        });
        it("renders edit button for connectors with parentCoord when editMode is enabled", () => {
            props = { ...props, editMode: true };
            column = shallow(<Column {...props} />);
            const lineHorizEdit = column.find({ id: "diamond|lineHoriz.edit" });
            const arrowRightEdit = column.find({ id: "diamond|arrowRight.edit" });
            expect(lineHorizEdit).toHaveLength(1);
            expect(arrowRightEdit).toHaveLength(1);
        });
    });
    it("passes correct props to Connector", () => {
        const empty = column.find({ id: "box|empty" });
        const lineHoriz = column.find({ id: "diamond|lineHoriz" });
        const arrowRight = column.find({ id: "diamond|arrowRight" });

        expect(
            empty.prop("createAddChildNodeCommand")
        ).toEqual(
            addNodeParams({ ownCoord: "0,1", parentCoord: undefined })
        );

        expect(
            lineHoriz.prop("createAddChildNodeCommand")
        ).toEqual(
            addNodeParams({ ownCoord: "3,3", parentCoord: "2,2" })
        );

        expect(
            arrowRight.prop("createAddChildNodeCommand")
        ).toEqual(
            addNodeParams({ ownCoord: "3,4", parentCoord: "2,4" })
        );
    });
});
