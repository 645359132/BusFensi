import { WritableDraft } from "immer";
import { OSMMapStore } from "../../store";
import { FeatureRefObj, FeatureState, FeatureTypes, NumericString } from "../../../../type/osm/refobj";
/* *
 * 修改指定特征的本地状态
 * @param state Immer 可写草稿状态，用于直接修改状态树
 * @param type 特征类型（node/way/relation）
 * @param id 特征的数字ID
 * @param modify 状态修改回调函数，接收当前特征的本地状态
 *
 * */
export function modifyFeatureStateHelper(
    state: WritableDraft<OSMMapStore>,
    type: FeatureTypes,
    id: NumericString,
    modify: (feature: WritableDraft<FeatureState>) => void
) {
    const featureState = state.meta[type][id]['@_localStates'];
    if (featureState) {
        modify(featureState);
    }
}
/* *
 * 修改指定特征的本地状态
 * @param state Immer 可写草稿状态，用于直接修改状态树
 * @param type 特征类型（node/way/relation）
 * @param id 特征的数字ID
 * @param modify 状态修改回调函数，接收当前特征的本地状态
 * */
export function createFeatureStateHelper(
    state: WritableDraft<OSMMapStore>,
    type: FeatureTypes,
    id: NumericString,
) {
    state.meta[type][id]['@_localStates'] = {
        visible: true,
        highlighted: false,
        hovered: false,
        selected: false,
        active: false
    }
}
/* *
 * 删除特征状态并清理相关引用
 * @param state Immer 可写草稿状态
 * @param type 特征类型
 * @param id 特征ID
 * @desc 操作流程：
 * 1. 从选中列表中移除匹配的特征
 * 2. 如果当前活动特征是被删除的特征，清空活动引用
 * 3. 删除特征元数据中的本地状态对象
 */
export function deleteFeatureStateHelper(
    state: WritableDraft<OSMMapStore>,
    type: FeatureTypes,
    id: NumericString,
) {
    if (!state.meta[type]?.[id]) return;
    // delete state.meta[type][id]['@_localStates'];
    const match = (ref: FeatureRefObj) => (ref.type === type && ref.id === id)
    if (state.selectedRef.some(match)) {
        state.selectedRef = state.selectedRef.filter((ref) => !match(ref));
    }
    if (state.activeRef && match(state.activeRef)) {
        state.activeRef = undefined;
    }
    if (state.meta[type][id]['@_localStates']) {
        delete state.meta[type][id]['@_localStates'];
    }
}

function _activeFeature(
    state: WritableDraft<OSMMapStore>,
    type: FeatureTypes,
    id: NumericString,
) {
    if (!state.meta[type]?.[id]) return;
    if (!state.meta[type][id]['@_localStates']) {
        createFeatureStateHelper(state, type, id)
    }
    if (state.activeRef) {
        const { type: t, id: i } = state.activeRef;
        if (state.meta[t][i]['@_localStates']) state.meta[t][i]['@_localStates'].active = false
    }
    state.activeRef = { type: type, id: id }
    if (state.meta[type][id]['@_localStates']) state.meta[type][id]['@_localStates'].active = true
}

function _selectFeature(
    state: WritableDraft<OSMMapStore>,
    type: FeatureTypes,
    id: NumericString,
) {
    const match = (ref: FeatureRefObj) => (ref.type === type && ref.id === id)
    if (!state.selectedRef.some(match)) {
        state.selectedRef.push({ type: type, id: id })
        if (state.meta[type][id]['@_localStates']) state.meta[type][id]['@_localStates'].selected = true
    }
}
/* *
 * 清除所有选中和激活状态
 * @param state Immer 可写草稿状态
 * @desc 操作流程：
 * 1. 取消当前激活特征的状态
 * 2. 遍历所有选中特征，取消选中状态
 * 3. 清空选中列表
 */
export function clearSelectHelper(
    state: WritableDraft<OSMMapStore>,
) {
    state.selectedRef.forEach(({ type, id }) => {
        if (state.meta[type]?.[id]?.['@_localStates']) {
            state.meta[type][id]['@_localStates']!.selected = false
        }
    })
    if (state.activeRef) {
        const { type, id } = state.activeRef
        if (state.meta[type]?.[id]?.['@_localStates']) {
            state.meta[type][id]['@_localStates']!.active = false
        }
        state.activeRef = undefined
    }
    state.selectedRef = [];
}
/* *
 * 选择并激活指定特征
 * @param state Immer 可写草稿状态
 * @param type 特征类型
 * @param id 特征ID
 * @desc 操作流程：
 * 1. 将特征添加到选中列表
 * 2. 设置特征为激活状态
 */
export function selectFeatureHelper(
    state: WritableDraft<OSMMapStore>,
    type: FeatureTypes,
    id: NumericString,
) {
    _selectFeature(state, type, id)
    _activeFeature(state, type, id);
}