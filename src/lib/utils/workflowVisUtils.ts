/* eslint-disable import/no-cycle */
// Utils
import { clone, chain, sort } from "ramda";
import MinHeap from "./MinHeap";

// Types
import {
    ConnectorName, WorkflowVisData, WorkflowStepNodes, Matrix,
    MatrixCoord, ConnectorToPlace, CoordPairT, TileContainer,
    NextNode, TileType
} from "../types/workflowVisTypes";
import {
    WorkflowStep, encodedNodeType, Utils
} from "../../config";
import {
    OccurrenceDict, ExistentialDict, EndomorphDict, PolymorphDict
} from "../types/generic";

// Constants
const MATRIX_PLACEHOLDER_NAME = ConnectorName.EMPTY;

/**
 * Encodes colNum and rowNum as comma delimited string
 *
 * @param {number} colNum
 * @param {number} rowNum
 * @returns {string} a comma delimited string encoding colNum and rowNum
 */
export const encodeMatrixCoord = ({ colNum, rowNum }: MatrixCoord): string => `${colNum},${rowNum}`;

/**
 * Decodes colNum and rowNum from comma delimited string
 *
 * @param {string} colRow a comma delimited string encoding colNum and rowNum
 * @returns {number} colNum
 * @returns {number} rowNum
 */
export const decodeMatrixCoord = (colRow: string): MatrixCoord => {
    const [colNum, rowNum] = colRow.split(",").map((s) => +s);
    return { colNum, rowNum };
};

/**
 * Creates a string from the given parameters encoding information about the matrix entry
 *
 * @param {ColType} colType
 * @param {string} entryName
 * @param {string} encodedOwnCoord
 * @param {string} encodedParentCoord
 * @return {string} matrixEntry - a period delimited string that encodes all the params
 */
export const encodeMatrixEntry = (
    {
        tileType, tileContainer, tileId, encodedOwnCoord, encodedParentCoord
    }: {
        tileType: TileType;
        tileContainer: TileContainer;
        tileId: string;
        encodedOwnCoord: string;
        encodedParentCoord?: string;
    }
): string => {
    const parentCoord = encodedParentCoord ? `|${encodedParentCoord}` : "";
    return `${tileType}|${tileContainer}|${tileId}|${encodedOwnCoord}${parentCoord}`;
};

/**
 * Get info about the tile from the matrixEntry string
 *
 * @param {string} matrixEntry
 * @returns {ColType} tileType
 * @returns {string} tileId
 * @returns {(string|undefined)} tileName
 * @returns {(string|undefined)} encodedOwnCoord
 * @returns {(string|undefined)} encodedParentNodeCoord - coord of a workflowStep
 */
export const decodeMatrixEntry = (matrixEntry: string): {
    tileType: TileType;
    tileContainer: TileContainer;
    tileId: string;
    encodedOwnCoord: string;
    encodedParentNodeCoord: string | undefined;
} => {
    const [tileType, tileContainer, tileId, encodedOwnCoord, encodedParentNodeCoord] = matrixEntry.split("|");

    return {
        tileType: tileType as TileType,
        tileContainer: tileContainer as TileContainer,
        tileId,
        encodedOwnCoord,
        encodedParentNodeCoord
    };
};

/**
 * Determines the rowNum of the first unoccupied (empty) tile
 *
 * @param {string[]} col
 * @return {number} rowNum
 */
export const isPlaceholder = (matrixEntry: string): boolean => {
    const { tileType, tileId } = decodeMatrixEntry(matrixEntry);
    return tileType === TileType.CONNECTOR && tileId === MATRIX_PLACEHOLDER_NAME;
};

/**
 * Determines the rowNum of the first empty slot in a column
 * @param {string[]} col
 * @returns {number} rowNum
 */
export const firstUnoccupiedInCol = (
    col: string[]
): number => col.findIndex((matrixEntry: string) => isPlaceholder(matrixEntry));

/**
 * Determines the rowNum of the last non-empty slot in a column that's a node
 * @param {string[]} col
 * @returns {number} rowNum
 */
export const lastNodeInCol = (col: string[]): number => {
    for (let i = col.length - 1; i >= 0; i -= 1) {
        const matrixEntry = col[i];
        const { tileType } = decodeMatrixEntry(matrixEntry);

        if (tileType !== TileType.CONNECTOR) return i;
    }
    return -1;
};

/**
 * Determines the rowNum of the last non-empty slot in a column
 * @param {string[]} col
 * @returns {number} rowNum
 */
export const lastOccupiedInCol = (col: string[]): number => {
    for (let i = col.length - 1; i >= 0; i -= 1) {
        const matrixEntry = col[i];

        if (!isPlaceholder(matrixEntry)) return i;
    }
    return -1;
};

// Mutable function (mutates matrix) instead of returning
// a new matrix for performance reasons
const replaceTile = (
    { matrix, replaceBy, coord }: { matrix: Matrix; replaceBy: string; coord: MatrixCoord }
): void => {
    const { rowNum, colNum } = coord;

    const newCol = clone(matrix[colNum]);
    newCol[rowNum] = replaceBy;
    // eslint-disable-next-line no-param-reassign
    matrix[colNum] = newCol;
};


/**
 *
 * @param {number} numRows number of rows
 * @param {number} colNum column number
 * @param {tileContainer} tileContainer
 * @returns {string[]} an array of matrixEntries
 */
export const initCol = ({
    numRows, colNum, tileContainer
}: {
    numRows: number; colNum: number; tileContainer: TileContainer;
}): string[] => Array.from(Array(numRows).keys())
    .map((rowNum) => encodeMatrixEntry({
        tileType: TileType.CONNECTOR,
        tileContainer,
        tileId: MATRIX_PLACEHOLDER_NAME,
        encodedOwnCoord: encodeMatrixCoord({ colNum, rowNum })
    }));

/**
 * Creates a numCols x numRows matrix initialized with placeholders
 * (box.empty, diamond.empty, or standard.empty)
 *
 * @param {number} numRows
 * @param {tileContainers} tileContainers array of TileContainers - box, diamond, or standard
 * @returns {Matrix} a 2D array of matrixEntries
 */
export const initMatrix = (
    { numRows, tileContainers }: { numRows: number; tileContainers: TileContainer[] }
): Matrix => tileContainers.map((tileContainer: TileContainer, i: number) => initCol({
    numRows, colNum: i, tileContainer
}));

// TODO: test getPrevSteps
// getPrevSteps and get NextSteps are utils
const getPrevSteps = ({ workflowSteps, workflowStepOrder }: {
    workflowSteps: WorkflowStep[]; workflowStepOrder: number;
}): WorkflowStep[] => workflowSteps.filter(
    (wfStep) => wfStep.workflowStepType !== encodedNodeType.fork
    && wfStep.workflowStepOrder < workflowStepOrder
);

export const getNextSteps = ({ workflowSteps, workflowStepOrder }: {
    workflowSteps: WorkflowStep[]; workflowStepOrder: number;
}): WorkflowStep[] => workflowSteps
    .filter((wfStep) => wfStep.workflowStepOrder > workflowStepOrder);

// TODO: Need a huge refactor of this function
const createWorkflowStepNodes = ({ workflowSteps, workflowUid }: {
    workflowUid: string;
    workflowSteps: WorkflowStep[];
}): {
    workflowStepNodes: WorkflowStepNodes;
    workflowStepOrderOccur: OccurrenceDict;
    firstStepId: string;
    forkStepCols: number[];
} => {
    // TODO: need to move this out of the function
    const firstStepId = `${workflowUid}-auth`;

    let workflowStepNodes: WorkflowStepNodes = {};
    let authorizeNextNodes: { id: string; primary: boolean }[] = [];
    let forkStepCols: number[] = [];

    const workflowStepOrderOccur: OccurrenceDict = {};
    for (let i = 0; i < workflowSteps.length; i += 1) {
        const workflowStep = workflowSteps[i];

        // TODO: remove destructuring here
        // Create a function called `getNodeFromStep` which takes workflowStep
        // Create a function called `getWorkflowStepOrder` which takes workflowStep
        const {
            workflowStepOrder,
            workflowStepUid,
            workflowStepName
        } = workflowStep;

        // We need to convert all keys for dictionaries to a string because key of a dictionary
        // must be string as we defined it in types/generics
        const stringifiedWorkflowStepOrder = String(workflowStepOrder);

        workflowStepOrderOccur[stringifiedWorkflowStepOrder] = (
            workflowStepOrderOccur[stringifiedWorkflowStepOrder]
                ? workflowStepOrderOccur[stringifiedWorkflowStepOrder]
                : 0) + 1;

        const nodeType = Utils.getNodeType({ workflowStep });
        if (nodeType === encodedNodeType.fork) {
            forkStepCols = forkStepCols.concat(workflowStepOrder * 2);
        }

        // TODO: authorizeNextNodes is the next node of `authorize` step
        // This logic should not be in the visualization lib.
        if (workflowStepOrder === 1) {
            authorizeNextNodes = [{ id: workflowStepUid, primary: true }];
        }

        // Not sure if we need prevSteps...?
        const prevSteps = getPrevSteps({ workflowSteps, workflowStepOrder });

        workflowStepNodes[workflowStepUid] = {
            id: workflowStepUid,
            workflowUid,
            name: workflowStepName,
            nodeType,
            workflowStepOrder,
            nextNodes: Utils.getNextNodes(workflowStep),
            nextSteps: getNextSteps({ workflowSteps, workflowStepOrder }),
            prevSteps,
            isDisabled: Utils.getIsDisabled(workflowStep),
            displayWarning: Utils.getDisplayWarning(workflowStep)
        };
    }

    // TODO: We should append authorize to the workflowVisData before we go into this function
    // to derive nodes from workflowVis Data
    workflowStepNodes = {
        ...workflowStepNodes,
        [firstStepId]: {
            id: firstStepId,
            workflowUid: firstStepId,
            name: "",
            nodeType: encodedNodeType.start,
            workflowStepOrder: 0,
            nextNodes: authorizeNextNodes,
            nextSteps: getNextSteps({ workflowSteps, workflowStepOrder: 0 }),
            prevSteps: [],
            isDisabled: false,
            displayWarning: null
        }
    };

    return {
        firstStepId, workflowStepNodes, workflowStepOrderOccur, forkStepCols
    };
};


/**
 * Creates the workflowVisData and initial matrix
 *
 * @param {string[]} workflowSteps
 * @param {string} workflowUid
 * @returns {WorkflowVisData} workflowVisData
 * @returns {Matrix} initialMatrix
 * @returns {number[]} forkStepCols - the colNums where decision steps are
 */
export const createWorkflowVisData = (
    { workflowSteps, workflowUid }: { workflowSteps: WorkflowStep[]; workflowUid: string }
): { workflowVisData: WorkflowVisData; initialMatrix: Matrix; forkStepCols: number[] } => {
    const {
        firstStepId, workflowStepNodes, workflowStepOrderOccur, forkStepCols
    } = createWorkflowStepNodes({ workflowSteps, workflowUid });
    const workflowVisData = {
        firstStep: firstStepId,
        workflowStepNodes
    };

    const numCols = (Math.max(...Object.keys(workflowStepOrderOccur).map((id) => +id)) * 2) + 1;

    // Naive: if we see at least one decision step, we want to add an additional row to the matrix
    // to accommodate the dash line add button
    const numRows = Math.max(...Object.values(workflowStepOrderOccur))
        + (+(forkStepCols.length > 0));

    const tileContainers = Array(numCols).fill(TileContainer.STANDARD).map((tileContainer, i) => {
        if (i % 2 === 1) return tileContainer;
        return forkStepCols.includes(i) ? TileContainer.DIAMOND : TileContainer.BOX;
    });

    const initialMatrix = initMatrix({ numRows, tileContainers });

    return {
        workflowVisData,
        initialMatrix,
        forkStepCols
    };
};

/**
 * Adds a new Node to the matrix. Mutates the original matrix.
 *
 * @param {Matrix} matrix
 * @param {number} colNum
 * @param {string} newNodeId
 * @returns {MatrixCoord} { rowNum, colNum } of the newly added Node in the matrix
 */
export const addNodeToMatrix = (
    {
        matrix, colNum, newNodeId, encodedParentCoord
    }: {
        matrix: Matrix;
        colNum: number;
        newNodeId: string;
        encodedParentCoord: string | undefined;
    }
): MatrixCoord => {
    // console.log("encodedParentCoord: ", encodedParentCoord);
    const col = matrix[colNum];

    // Determine rowNum
    // Naive: rowNum is the first unoccupied
    // Better: If no parent, rowNum is the first unoccupied.
    // If has parent, rowNum is parent rowNum or first unoccupied, whichever is greater
    // Note, in this iteration, we are assuming that the tile at parent's rowNum is unoccupied
    // but that's not necessarily true. In a future iteration, we want to also check that the
    // tile at parent's rowNum is unoccupied. If it's occupied, we want to change the size of
    // of the matrix.
    const firstUnoccupiedRowNum = firstUnoccupiedInCol(col);
    let rowNum: number;
    if (encodedParentCoord) {
        const { rowNum: parentRowNum } = decodeMatrixCoord(encodedParentCoord);
        rowNum = Math.max(parentRowNum, firstUnoccupiedRowNum);
    } else {
        rowNum = firstUnoccupiedRowNum;
    }

    // TODO:
    // Best: if no parent, rowNum is the first unoccupied. If has parent, rowNum is parent rowNum
    // but if that is occupied, then we shift col 2 places to the right
    // Also need to consider if the step is primary. If it is primary, it has to be in the first
    // place in col
    // TODO: Need to have a function for replace col type
    // We also need to change the size of the matrix and shift all the nodes to the right and down

    const { tileContainer, encodedOwnCoord } = decodeMatrixEntry(col[0]);
    const tileType = tileContainer === TileContainer.DIAMOND ? TileType.FORK : TileType.NODE;
    const replaceBy = encodeMatrixEntry({
        tileType,
        tileContainer,
        tileId: newNodeId,
        encodedOwnCoord
    });

    replaceTile({
        coord: { colNum, rowNum },
        matrix,
        replaceBy
    });
    return { rowNum, colNum };
};

/**
 * Mutates the matrix by replacing tiles with connectors
 *
 * @param {Matrix} matrix initial matrix with workflowSteps already placed
 * @param {ConnectorToPlace} connectorToPlace instruction for how to place a connectors into matrix
 * @param {string[]} nodeCoords an array of matrix coords for all the nodes (i.e., workflowSteps)
 * @returns {string} replaceBy - string for the new connector matrixEntry
 */
export const addConnectorToMatrix = (
    { matrix, connectorToPlace, nodeCoords }: {
        matrix: Matrix; connectorToPlace: ConnectorToPlace; nodeCoords: string[];
    }
): { replaceBy: string } => {
    const { ownCoord, parentCoord, connectorName } = connectorToPlace;
    const { colNum, rowNum } = decodeMatrixCoord(ownCoord);
    const { tileType, tileContainer } = decodeMatrixEntry(matrix[colNum][rowNum]);

    const parentNodeCoord: string | undefined = nodeCoords.includes(parentCoord)
        ? parentCoord : undefined;

    const replaceBy = encodeMatrixEntry({
        tileType,
        tileContainer,
        tileId: connectorName,
        encodedOwnCoord: ownCoord,
        encodedParentCoord: parentNodeCoord
    });

    replaceTile({
        matrix,
        replaceBy,
        coord: { colNum, rowNum }
    });

    return { replaceBy };
};

/**
 * Creates an array of parentCoord/childCoord pairs for use by connectorBetweenNodes
 *
 * @param {EndomorphDict} nodeIdToCoord
 * @param {PolymorphDict} nodeToParentCoords
 * @returns {CoordPairT[]} an array of pairs of coords (parentNode and childNode)
 */
export const createCoordPairs = (
    { nodeIdToCoord, nodeIdToParentCoords }: {
        nodeIdToCoord: EndomorphDict;
        nodeIdToParentCoords: PolymorphDict;
    }
): CoordPairT[] => {
    const nodeIds = Object.keys(nodeIdToParentCoords);

    const newCoord = (
        nodeId: string
    ): CoordPairT[] => nodeIdToParentCoords[nodeId].map((colRow: string) => ({
        parentCoord: decodeMatrixCoord(colRow),
        childCoord: decodeMatrixCoord(nodeIdToCoord[nodeId])
    }));

    return chain((nodeId) => newCoord(nodeId), nodeIds);
};

/**
 * Create a sequence of LineHoriz and returns the coordinate of the last LineHoriz
 *
 * @param {number} startCol
 * @param {number} endCol
 * @param {number} rowNum
 * @param {string} parentCoord
 * @returns {ConnectorToPlace[]} lines - an array of ConnectorToPlace for lineHoriz
 * @returns {string} lastLineCoord - the coord of the last lineHoriz in the series
 */
export const createLineHorizes = (
    {
        startCol, endCol, rowNum, parentCoord
    }: {
        startCol: number; endCol: number; rowNum: number; parentCoord: string;
    }
): { lines: ConnectorToPlace[]; lastLineCoord: string } => {
    let lines: ConnectorToPlace[] = [];
    let currParentCoord = parentCoord;
    for (let colNum = startCol; colNum < endCol; colNum += 1) {
        const ownCoord = encodeMatrixCoord({ colNum, rowNum });
        const newEntry = {
            ownCoord,
            parentCoord: currParentCoord,
            connectorName: ConnectorName.LINE_HORIZ
        };
        lines = lines.concat(newEntry);
        currParentCoord = encodeMatrixCoord({ colNum, rowNum });
    }

    return { lines, lastLineCoord: currParentCoord };
};


/**
 * Creates an array of connectors to place with specific values and locations in the matrix
 * Only in the horizontal direction
 *
 * @param {MatrixCoord} parentCoord
 * @param {MatrixCoord} childCoord
 * @returns {ConnectorToPlace[]} an array of ConnectorToPlace for between the
 * colNums of parent and child nodes
 */
export const createHorizConnectorsBetweenNodes = (coordPair: CoordPairT): ConnectorToPlace[] => {
    const { parentCoord, childCoord } = coordPair;
    const { colNum: fromCol, rowNum: fromRow } = parentCoord;
    const { colNum: toCol, rowNum: toRow } = childCoord;

    const parentNodeCoord = encodeMatrixCoord({ colNum: fromCol, rowNum: fromRow });

    // Case 1: fromRow = toRow
    // should be lineHoriz, ..., arrowRight
    // row should be fromRow.
    // fill connectors at: fromCol+1 until toCol-1
    if (fromRow === toRow) {
        const startCol = fromCol + 1;
        const endCol = toCol - 1;
        const rowNum = fromRow;

        const { lines, lastLineCoord } = createLineHorizes({
            startCol, endCol, rowNum, parentCoord: parentNodeCoord
        });

        const lastEntry = {
            ownCoord: encodeMatrixCoord({ colNum: endCol, rowNum }),
            connectorName: ConnectorName.ARROW_RIGHT,
            parentCoord: lastLineCoord
        };

        return lines.concat(lastEntry);
    }

    // Case 2: fromRow < toRow
    // should be downRight, lineHoriz, ..., arrowRight
    // row should be toRow.
    // fill connectors at: fromCol until toCol-1
    if (fromRow < toRow) {
        const startCol = fromCol;
        const endCol = toCol - 1;
        const rowNum = toRow;

        // NOTE: Although downRight's parent is really the node, parentCoord is used to
        // Support rendering of the plus sign. Only the connector that renders the plus sign
        // can have its parentCol to be the parent node's col. Since we don't want to render
        // the plus sign on the downRight connector, we need to make sure this connector's
        // parentCoord is pointing to an empty slot in the matrix
        const firstEntry = {
            ownCoord: encodeMatrixCoord({ colNum: startCol, rowNum }),
            parentCoord: encodeMatrixCoord({ colNum: fromCol - 1, rowNum }),
            connectorName: ConnectorName.DOWN_RIGHT
        };
        const { lines, lastLineCoord } = createLineHorizes({
            startCol: startCol + 1, endCol, rowNum, parentCoord: parentNodeCoord
        });

        const lastEntry = {
            ownCoord: encodeMatrixCoord({ colNum: endCol, rowNum }),
            parentCoord: lastLineCoord,
            connectorName: ConnectorName.ARROW_RIGHT
        };

        return [firstEntry].concat(lines).concat(lastEntry);
    }

    // Case 3: fromRow > toRow
    // should be lineHoriz, ..., rightUpArrow
    // row should be fromRow.
    // fill connectors at: fromCol+1 until toCol
    const startCol = fromCol + 1;
    const endCol = toCol;
    const rowNum = fromRow;
    const { lines, lastLineCoord } = createLineHorizes({
        startCol, endCol, rowNum, parentCoord: parentNodeCoord
    });

    const lastConnectorName = ((fromRow - toRow) > 1) ? ConnectorName.RIGHT_UP
        : ConnectorName.RIGHT_UP_ARROW;
    const lastEntry = {
        ownCoord: encodeMatrixCoord({ colNum: endCol, rowNum }),
        connectorName: lastConnectorName,
        parentCoord: lastLineCoord
    };

    return lines.concat(lastEntry);
};

/**
 * Get coords of rightUp connectors in the matrix
 *
 * @param {ConnectorToPlace} connectorToPlace
 * @returns {MatrixCoord[]} rightUpCoords - coords for where all the rightUp connectors go
 */
export const getRightUpCoords = (
    connectorsToPlace: ConnectorToPlace[]
): MatrixCoord[] => connectorsToPlace
    .filter(({ connectorName }) => connectorName === ConnectorName.RIGHT_UP)
    .map(({ ownCoord }) => decodeMatrixCoord(ownCoord));


/**
 * Adds vertical line and up arrow to a column in the matrix beginning from startCoord
 *
 * @param {Matrix} matrix
 * @param {MatrixCoord} startCoord
 * @returns void - mutates the matrix
 */
export const addVertConnectorsToMatrix = (
    { matrix, startCoord }: { matrix: Matrix; startCoord: MatrixCoord }
) => {
    const { colNum, rowNum } = startCoord;
    const col = clone(matrix[colNum]);

    for (let currentRowIndex = rowNum - 1; currentRowIndex >= 1; currentRowIndex -= 1) {
        const curr = col[currentRowIndex];
        const above = col[currentRowIndex - 1];
        if (!isPlaceholder(curr)) {
            break;
        }

        const {
            tileType, tileContainer, encodedOwnCoord, encodedParentNodeCoord
        } = decodeMatrixEntry(curr);
        const { tileType: aboveTileType } = decodeMatrixEntry(above);

        const connectorName = (isPlaceholder(above) || aboveTileType === TileType.CONNECTOR)
            ? ConnectorName.LINE_VERT : ConnectorName.ARROW_UP;

        const replaceBy = encodeMatrixEntry({
            tileType,
            tileContainer,
            tileId: connectorName,
            encodedOwnCoord: encodedOwnCoord as string,
            encodedParentCoord: encodedParentNodeCoord as string
        });
        col[currentRowIndex] = replaceBy;
    }

    // mutate matrix
    // eslint-disable-next-line no-param-reassign
    matrix[colNum] = col;
};

/**
 * Takes a dictionary and returns a new dictionary with the key and value swapped
 *
 * @param {EndomorphDict} keyToVal
 * @param {EndomorphDict} valToKey
 */
export const invertKeyVal = (
    keyToVal: EndomorphDict
): EndomorphDict => Object.keys(keyToVal).map((key) => [key, keyToVal[key]]).reduce((acc, curr) => {
    const [key, val] = curr;
    const valToKey = { [val]: key };
    return { ...acc, ...valToKey };
}, {});


/**
 * Provides instruction for where to place a dash line forking from decision step
 *
 * @param {Matrix} matrix
 * @param {number[]} forkStepCols
 * @returns {Array} {replaceBy, coord}[]
 */
export const downRightDashesToPlace = (
    { matrix, forkStepCols }: { matrix: Matrix; forkStepCols: number[] }
): { replaceBy: string; coord: MatrixCoord }[] => forkStepCols.map((colNum) => {
    const col = matrix[colNum];
    const parentRowNum = lastNodeInCol(col);
    const rowNum = lastOccupiedInCol(col) + 1;
    const encodedOwnCoord = encodeMatrixCoord({ colNum, rowNum });
    const encodedParentNodeCoord = encodeMatrixCoord({ colNum, rowNum: parentRowNum });

    const tileContainer = TileContainer.DIAMOND;

    const replaceBy = encodeMatrixEntry({
        tileType: TileType.CONNECTOR,
        tileContainer,
        tileId: ConnectorName.DOWN_RIGHT_DASH,
        encodedOwnCoord,
        encodedParentCoord: encodedParentNodeCoord
    });
    return {
        replaceBy,
        coord: { colNum, rowNum }
    };
});

const getRowNum = (
    { nodeId, nodeIdToCoord }: { nodeId: string; nodeIdToCoord: EndomorphDict }
) => decodeMatrixCoord(nodeIdToCoord[nodeId]).rowNum;

const parentIdSortBy = (nodeIdToCoord: EndomorphDict) => (
    a: string, b: string
) => getRowNum({ nodeId: a, nodeIdToCoord }) - getRowNum({ nodeId: b, nodeIdToCoord });

/**
 * Get an array of nodeIds starting from given starting node until the sink node in the given graph
 * NOTE: An important assumption here is all the descendants of
 * node only has one child. This is fine for now as we limit ourselves to
 * only one decision step per visualization.
 *
 * @param {string} node - the starting node's id
 * @param {WorkflowStepNodes} workflowStepNodes - mapping from nodeId to an array children's nodeIds
 * @param {Array<string>} path - array of nodeIds beginning with given node
 * @returns {Array<string>} path - array of nodeIds beginning with given node
 */
export const getPath = ({
    node, workflowStepNodes, path
}: { node: string; workflowStepNodes: WorkflowStepNodes; path: string[] }): string[] => {
    const children = workflowStepNodes[node].nextNodes.map((n) => n.id);

    if (children.length === 0) {
        return path;
    }
    const [child] = children;
    return getPath({
        node: child,
        workflowStepNodes,
        path: path.concat(child)
    });
};

/**
 * Find path with the closest common descendant to to the currPrimaryPath
 * common descendant marks the point of convergence into the currPrimaryPath
 *
 * @param {Array<string>} currPrimaryPath
 * @param {Array<string>} nodesToSort - nodeIds of nodes left to sort
 * @param {Object} paths - mapping from nodeId of members of nodeToSort to their paths in the graph
 * @returns {string} nodeToAdd
 */
export const findNodeWithClosestCommonDescendant = (
    { currPrimaryPath, nodesToSort, paths }: {
        currPrimaryPath: string[]; nodesToSort: string[]; paths: PolymorphDict;
    }
): string => {
    for (let i = 1; i < currPrimaryPath.length; i += 1) {
        const unsortedCandidatePaths = nodesToSort.map((node) => ({
            head: node,
            commonAncestorIndex: paths[node].indexOf(currPrimaryPath[i])
        })).filter(
            ({ commonAncestorIndex }) => (commonAncestorIndex > 0)
        );

        const candidatePaths = sort(
            (a, b) => (a.commonAncestorIndex - b.commonAncestorIndex),
            unsortedCandidatePaths
        );

        if (candidatePaths.length > 0) {
            const nodeToAdd = candidatePaths[0].head;
            return nodeToAdd;
        }
    }
    // TODO: Do we ever expect to get here?
    // We don't expect to ever get here but in case we do, we want to reduce the length of
    // nodesToSort to prevent infinite recursion.
    return nodesToSort[0];
};

/**
 * Given a collection of nodes to be sorted, paths drawn from these nodes until the sink node of
 * the graph, and an initial primaryPath, recursively find the next primaryPath based on closest
 * point of convergence of the path beginning from the node into the currPrimaryPath.
 * Designate the next node and as the new primary node and remove the next node from the
 * collection of nodes to be sorted.
 *
 * @param {Array<string>} currPrimaryPath
 * @param {Array<string>} sortedNodes
 * @param {Array<string>} nodesToSort
 * @param {Object} paths
 * @param {Array<string>} sortedNodes - includes the primaryNode as head of array
 * @returns {Array<string>} sortedNodes - updated sortedNodes
 */
export const closestCommonDescendantSort = (
    {
        currPrimaryPath, sortedNodes, nodesToSort, paths
    }: {
        currPrimaryPath: string[];
        sortedNodes: string[];
        nodesToSort: string[];
        paths: PolymorphDict;
    }
): string[] => {
    if (nodesToSort.length === 0) {
        return sortedNodes;
    }

    const nodeToAdd = findNodeWithClosestCommonDescendant({ currPrimaryPath, nodesToSort, paths });

    return closestCommonDescendantSort({
        currPrimaryPath: paths[nodeToAdd],
        sortedNodes: sortedNodes.concat(nodeToAdd),
        nodesToSort: nodesToSort.filter((node) => node !== nodeToAdd),
        paths
    });
};

/**
 * sort nodes which share common parent by closest common descendant
 *
 * @param {Array<{id, primary}>} nextNodes - the nodes which share common parent
 * @param {Object} WorkflowStepNodes
 * @returns {Array<string>} sortedNextNodes
 */
export const getSortedNextNodes = (
    { nextNodes, workflowStepNodes }: {
        nextNodes: NextNode[]; workflowStepNodes: WorkflowStepNodes;
    }
): string[] => {
    if (nextNodes.length < 2) return nextNodes.map((node) => node.id);
    const primaryNode = nextNodes.find((nextNode: NextNode) => nextNode.primary);
    const primaryNodeId: string = primaryNode ? primaryNode.id : nextNodes[0].id;

    const nodes: string[] = nextNodes.map((nextNode) => nextNode.id);

    const paths: PolymorphDict = nodes.reduce((acc: PolymorphDict, node: string) => (
        {
            ...acc,
            [node]: getPath({
                node,
                workflowStepNodes,
                path: [node]
            })
        }
    ), {});

    return closestCommonDescendantSort({
        currPrimaryPath: paths[primaryNodeId],
        sortedNodes: [primaryNodeId],
        nodesToSort: nodes.filter((node) => node !== primaryNodeId),
        paths
    });
};

/**
 * Uses workflowVisData to populate initialMatrix with workflow steps and connectors
 *
 * @param {WorkflowVisData} workflowVisData
 * @param {Matrix} initialMatrix
 * @param {number[]} forkStepCols - the columns where decision steps reside
 * @returns {Matrix} matrix - populated matrix (may be a different size than initialMatrix)
 * @returns {EndomorphDict} nodeIdToCoord - a hashmap of nodeId to its matrix coord
 * @returns {PolymorphDict} nodeIdToParentNodeIds
 */
export const populateMatrix = (
    { workflowVisData, initialMatrix, forkStepCols }: {
        workflowVisData: WorkflowVisData;
        initialMatrix: Matrix;
        forkStepCols: number[];
    }
): { matrix: Matrix; nodeIdToCoord: EndomorphDict; nodeIdToParentNodeIds: PolymorphDict } => {
    const matrix = clone(initialMatrix);

    // Step 1 - Traverse graph (BFS) and generate nodeIdToParentCoords and nodeIdToCoord
    // together, these hash maps tell us how tiles in the matrix are connected

    const { firstStep, workflowStepNodes } = workflowVisData;

    const toExplore: MinHeap = new MinHeap();
    toExplore.insert({ val: firstStep, priority: 0 });

    const explored: ExistentialDict = {};

    // nodeId -> `${colNum},${rowNum}`
    const nodeIdToCoord: EndomorphDict = {};

    // nodeId -> `${colNum},${rowNum}`[]
    // nodeIdToParentCoords is a mapping from the id of a
    // node to an array of (colNum, rowNum) of its parent nodes
    const nodeIdToParentCoords: PolymorphDict = {};

    // nodeId -> nodeId[]
    const nodeIdToParentNodeIds: PolymorphDict = {};

    const offset = 0; // TODO: Does this ever change?

    // BFS with Min Heap to keep track of toExplore
    while (!toExplore.isEmpty()) {
        const min = toExplore.deleteMin();
        const id = min ? min.val : "";
        const workflowStepNode = workflowStepNodes[id];
        const { nextNodes, workflowStepOrder } = workflowStepNode;

        // Place the workflow step id into the matrix
        // We need to account for the coord of the parent node when placing a new
        // node into the matrix
        // Get Parents' Ids
        const parentIds = nodeIdToParentNodeIds[id];

        // sort parentIds by rowNum in ascending order
        const orderedParentIds = parentIds && sort(parentIdSortBy(nodeIdToCoord), parentIds);
        const parentId = parentIds ? orderedParentIds[0] : "";
        const encodedParentCoord = nodeIdToCoord[parentId]; // smallest rowNum

        const coord = addNodeToMatrix({
            matrix,
            colNum: (workflowStepOrder * 2) + offset,
            newNodeId: id,
            encodedParentCoord
        });

        // Add current node's coord into nodeIdToCoord
        nodeIdToCoord[id] = encodeMatrixCoord(coord);

        // TODO: nextNodes - if we are currently looking at a decision step,
        // there will be multiple steps. we want to sort the nextNodes here or sort it
        // in createWorkflowVisData to explore it in this order
        const sortedNextNodes = getSortedNextNodes({ nextNodes, workflowStepNodes });

        for (let i = 0; i < sortedNextNodes.length; i += 1) {
            const nextStepId = sortedNextNodes[i];

            // Update nodeIdToParentCoords here using nodeIdToCoord.
            // We are guaranteed that nextStep's parent's coord  is in nodeIdToCoord
            // because nextStep's parent is current node, which we just added to nodeIdToCoord above
            const parentCoordsEntry = nodeIdToParentCoords[nextStepId];
            nodeIdToParentCoords[nextStepId] = (parentCoordsEntry || []).concat(nodeIdToCoord[id]);

            const parentNodeIds = nodeIdToParentNodeIds[nextStepId];
            nodeIdToParentNodeIds[nextStepId] = (parentNodeIds || []).concat(id);
            if (!explored[nextStepId]) {
                // toExplore maintains the nodeIds in ascending order based on workflowStepOrder
                // Inefficient to sort everytime for an insert. We can do better on performance by
                // maintaining toExplore as a priority queue
                // console.log("inserting next step", workflowStepNodes[nextStepId]);
                // TODO: Create a function for calculating the priority.
                // If next step is primary, nextStepPriority will be a number between 0 and 1.
                // We want to explore all the nodes from the primnary branch from left to
                // right first. Then we want to explore the non-primary branches from left to right.
                // NOTE, the node with the smaller priority get explored first

                const childOrder = i / sortedNextNodes.length;
                const priority = workflowStepNodes[nextStepId].workflowStepOrder + childOrder;

                toExplore.insert({
                    val: nextStepId,
                    priority
                });
                explored[nextStepId] = true;
            }
        }
    }

    // Step 2 - Use parentCoords and nodeCoord to populate the matrix with connectors
    // Step 2.1 - place connectors horizontally
    const coordPairs: CoordPairT[] = createCoordPairs({ nodeIdToCoord, nodeIdToParentCoords });
    const connectorsToPlace: ConnectorToPlace[] = chain(
        createHorizConnectorsBetweenNodes, coordPairs
    );

    // TODO: we may need to place connectors into matrix first because that's when we find out
    // if we have a collision? The addConnectorToMatrix function should return a new matrix
    const nodeCoords: string[] = Object.values(nodeIdToCoord);
    // Populate matrix with regular connectors
    connectorsToPlace
        .forEach(
            (connectorToPlace) => addConnectorToMatrix({ matrix, connectorToPlace, nodeCoords })
        );


    // Step 2.2 - If there are right up connectors in the matrix, we want to draw
    // vertLine and arrowUp above them while the tile is empty.

    // TODO: We will cache the coord of all the rightUp connectors in the matrix
    // during createHorizConnectorsBetweenNodes. After that's implemented, we can get rid
    // of the nested for loop below

    getRightUpCoords(connectorsToPlace)
        .forEach(
            (rightUpCoord) => addVertConnectorsToMatrix({ matrix, startCoord: rightUpCoord })
        );

    // Step 2.3 - Decision Step Dashed line

    // Add the decision step dashline plus sign placeholder into the matrix where the decision
    // steps are
    // Populate matrix with downRight dash line connectors branching from diamond
    downRightDashesToPlace({ matrix, forkStepCols })
        .forEach((downRightDashToPlace) => replaceTile({
            matrix,
            replaceBy: downRightDashToPlace.replaceBy,
            coord: downRightDashToPlace.coord
        }));

    return { matrix, nodeIdToCoord, nodeIdToParentNodeIds };
};

/**
 * Given plusBtn coordinate and a list of candidate coordinates for where the next nodes could be,
 * determine the next node (there can only be one next node)
 *
 * @param {MatrixCoord} plusBtnCoord
 * @param {EndomorphDict} coordToNodeId
 * @param {string[]} candidateNodeIds
 */
export const findNextNode = ({
    plusBtnCoord, coordToNodeId, candidateNextNodeIds
}: {
    plusBtnCoord: MatrixCoord; coordToNodeId: EndomorphDict; candidateNextNodeIds: string[];
}): string => {
    // NOTE: It's assumed all candidateNextNodeIds are to the right of the plus button so their
    // colNum is irrelevant
    const { rowNum: plusBtnRowNum } = plusBtnCoord;

    const nodeIdToCoord = invertKeyVal(coordToNodeId);
    // keep going to the right until you see empty. Then go up.
    const candidateCoords: MatrixCoord[] = candidateNextNodeIds
        .map((nodeId: string) => nodeIdToCoord[nodeId])
        .map((encodedCoord: string) => decodeMatrixCoord(encodedCoord));
    const nextNodeCoord = candidateCoords
        .filter(({ rowNum }: { rowNum: number }) => rowNum <= plusBtnRowNum)
        .sort((a: MatrixCoord, b: MatrixCoord) => b.rowNum - a.rowNum)[0];

    return coordToNodeId[encodeMatrixCoord(nextNodeCoord)];
};
