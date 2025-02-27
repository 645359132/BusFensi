import { createComputed } from "zustand-computed"
import { FeatureMetaGroup, FeatureTypes, NumericString } from "../../../../type/osm/refobj"
import { OSMMapStore } from "../../store"
import { filterBusPTv2, filterCreated, filterHighway } from "../../../../utils/osm/filterV2"

export type CollectionItem = Record<FeatureTypes, Record<NumericString, boolean>>

type FeatureTreeNode = {
    id: NumericString
    type: FeatureTypes
    fathers: Record<FeatureTypes, NumericString[]>
    /** must in order, may includes non-exsist */
    childs: Record<FeatureTypes, NumericString[]>
}

export type FeatureTree = {
    elems: Record<FeatureTypes, Record<NumericString, FeatureTreeNode>>,
    roots: Record<FeatureTypes, Record<NumericString, boolean>>
}

export type Collection = {
    ptv2: CollectionItem,
    highway: CollectionItem,
    created: CollectionItem,
    global: CollectionItem
}

export interface ComputedFeatures {
    collections: Collection,
    tree: FeatureTree,
}

export const genTree = (
    renderedOSMFeatureMeta: FeatureMetaGroup
): FeatureTree => {
    const { node, way, relation } = renderedOSMFeatureMeta;
    const featureTree: FeatureTree = {
        elems: { node: {}, way: {}, relation: {} },
        roots: { node: {}, way: {}, relation: {} }
    };

    // 使用更高效的 Map 结构
    const typeMaps = {
        node: new Map<NumericString, FeatureTreeNode>(),
        way: new Map<NumericString, FeatureTreeNode>(),
        relation: new Map<NumericString, FeatureTreeNode>()
    };

    // 类型安全的初始化
    const initializeElements = <T extends FeatureTypes>(
        type: T,
        source: Record<NumericString, unknown>
    ) => {
        const ids = Object.keys(source) as NumericString[];
        for (const id of ids) {
            const newNode: FeatureTreeNode = {
                id,
                type,
                fathers: { node: [], way: [], relation: [] },
                childs: { node: [], way: [], relation: [] }
            };
            // 类型断言
            (featureTree.elems[type] as Record<NumericString, FeatureTreeNode>)[id] = newNode;
            typeMaps[type].set(id, newNode);
        }
    };

    initializeElements('node', node);
    initializeElements('way', way);
    initializeElements('relation', relation);

    // 处理 way 的节点关系
    for (const w of Object.values(way)) {
        const cur = typeMaps.way.get(w["@_id"]);
        if (!cur) throw new Error(`Missing way: ${w["@_id"]}`);

        for (const nd of w.nd ?? []) {
            const child = typeMaps.node.get(nd["@_ref"]);
            if (child) {
                child.fathers.way.push(cur.id);
                cur.childs.node.push(child.id);
            }
        }
    }

    // 处理 relation 的成员关系
    for (const rl of Object.values(relation)) {
        const cur = typeMaps.relation.get(rl["@_id"]);
        if (!cur) throw new Error(`Missing relation: ${rl["@_id"]}`);

        for (const mem of rl.member ?? []) {
            const memType = mem["@_type"];
            if (!['node', 'way', 'relation'].includes(memType)) continue;

            const child = typeMaps[memType as FeatureTypes].get(mem["@_ref"]);
            if (child) {
                child.fathers.relation.push(cur.id);
                cur.childs[memType as FeatureTypes].push(child.id);
            }
        }
    }

    // 根节点检测优化
    const isRootNode = (n: FeatureTreeNode) =>
        Object.values(n.fathers).every(arr => arr.length === 0);

    for (const type of ['node', 'way', 'relation'] as FeatureTypes[]) {
        for (const [id, node] of typeMaps[type]) {
            if (isRootNode(node)) {
                featureTree.roots[type][id] = true;
            }
        }
    }

    return featureTree;
};


export const genCollection = (osmFeatureMeta: FeatureMetaGroup): Collection => {
    // 优化合并算法
    const unionCollection = (...iterable: CollectionItem[]): CollectionItem => {
        const result: CollectionItem = { node: {}, way: {}, relation: {} };

        for (let i = 0; i < iterable.length; i++) {
            const col = iterable[i];
            Object.assign(result.node, col.node);
            Object.assign(result.way, col.way);
            Object.assign(result.relation, col.relation);
        }
        return result;
    };

    const { node, way, relation } = osmFeatureMeta;

    // 同步执行过滤操作
    const ptv2 = filterBusPTv2(node, way, relation);
    const highway = filterHighway(node, way, relation);
    const created = filterCreated(node, way, relation);

    return {
        ptv2,
        highway,
        created,
        global: unionCollection(ptv2, highway)
    };
};
export const computed = createComputed((state: OSMMapStore): ComputedFeatures => {
    return {
        collections: genCollection(state.meta),
        tree: genTree(state.meta)
    }
})