# ng2-virtuallist
A list component with a virtual layout feature, base on Angular6

# TODOs

* 修正虚拟布局失效策略，目前决定于是否预设了滚动容器宽度和高度，如果没有预设宽高，则不采用虚拟布局
* 计划加入渲染器对象池，降低重复创建渲染器的开销
* 支持虚拟布局策略：virtualLayoutStrategy
* 支持渲染器复用策略：recycleRendererStrategy
* 优化选中状态变更后的视图更新处理
* 优化滚动时的视图刷新速度与性能