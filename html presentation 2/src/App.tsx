import { useEffect, useMemo, useRef, useState } from "react"

type Screen = "home" | "upload" | "crop" | "fabrics" | "design" | "guide" | "complete" | "favorites" | "records" | "profile"
type Part = "head" | "body" | "arms" | "ears" | "legs"
type Crop = { x: number; y: number; w: number; h: number }
type Fabric = {
  id: string
  name: string
  image: string
  width: number
  height: number
  crop?: Crop
  sample?: number
}
type Assignments = Partial<Record<Part, string>>
type RecordItem = { id: string; createdAt: string; assignments: Assignments }

const A = "/assets"
const parts: { id: Part; label: string; quantity: number }[] = [
  { id: "head", label: "头部", quantity: 2 },
  { id: "body", label: "身体", quantity: 2 },
  { id: "arms", label: "手臂", quantity: 2 },
  { id: "ears", label: "耳朵", quantity: 4 },
  { id: "legs", label: "腿部", quantity: 2 },
]

const sampleFabrics: Fabric[] = [
  {
    id: "sample-stripe",
    name: "条纹",
    image: `${A}/8aed5.png`,
    width: 38,
    height: 42,
    sample: 1,
  },
  {
    id: "sample-check",
    name: "格纹",
    image: `${A}/8aed5.png`,
    width: 40,
    height: 45,
    sample: 2,
  },
  {
    id: "sample-flower",
    name: "小花",
    image: `${A}/8aed5.png`,
    width: 36,
    height: 40,
    sample: 3,
  },
  {
    id: "sample-blue",
    name: "蓝花",
    image: `${A}/8aed5.png`,
    width: 35,
    height: 39,
    sample: 4,
  },
]

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function ArtCrop({
  className = "",
  x,
  y,
  w,
  h,
  sourceW = 1312,
}: {
  className?: string
  x: number
  y: number
  w: number
  h: number
  sourceW?: number
}) {
  return (
    <div className={`art-crop ${className}`}>
      <img
        src={`${A}/8aed5.png`}
        alt=""
        draggable={false}
        style={{
          width: `${(sourceW / w) * 100}%`,
          height: "auto",
          left: `${(-x / w) * 100}%`,
          top: `${(-y / h) * 100}%`,
        }}
      />
    </div>
  )
}

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <img className={`icon ${className}`} src={`${A}/${name}.svg`} alt="" />
}

function StatusBar() {
  return (
    <div className="status" aria-hidden="true">
      <b>9:41</b>
      <span>
        <Icon name="ba11f" />
        <Icon name="4f636" />
        <Icon name="d33b7" />
      </span>
    </div>
  )
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="page-header">
      <button className="back" onClick={onBack} aria-label="返回上一页">
        <Icon name="47cb2" /> 返回
      </button>
      <h1>{title}</h1>
    </header>
  )
}

function BottomNav({
  active,
  go,
}: {
  active: Screen
  go: (screen: Screen) => void
}) {
  const items: { id: Screen; label: string; icon?: string }[] = [
    { id: "home", label: "首页", icon: "93f53" },
    { id: "favorites", label: "收藏" },
    { id: "records", label: "记录", icon: "c5179" },
    { id: "profile", label: "我的", icon: "38a11" },
  ]
  return (
    <nav className="bottom-nav" aria-label="底部导航">
      {items.map((item) => (
        <button
          key={item.id}
          className={active === item.id ? "active" : ""}
          onClick={() => go(item.id)}
        >
          {item.icon ? (
            <Icon name={item.icon} />
          ) : (
            <span className="bear-nav">♧</span>
          )}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

function FabricImage({ fabric }: { fabric: Fabric }) {
  if (fabric.sample)
    return <div className={`sample-fabric sample-${fabric.sample}`} />
  return <img src={fabric.image} alt={fabric.name} />
}

function App() {
  const [screen, setScreen] = useState<Screen>("home")
  const [history, setHistory] = useState<Screen[]>([])
  const [dialog, setDialog] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingImage, setPendingImage] = useState("")
  const [crop, setCrop] = useState<Crop>({ x: 20, y: 15, w: 60, h: 70 })
  const [width, setWidth] = useState(38)
  const [height, setHeight] = useState(42)
  const [fabrics, setFabrics] = useState<Fabric[]>(() =>
    readStored("rebear-fabrics", []),
  )
  const [assignments, setAssignments] = useState<Assignments>(() =>
    readStored("rebear-design", {}),
  )
  const [selectedPart, setSelectedPart] = useState<Part>("head")
  const [guideStep, setGuideStep] = useState(0)
  const [records, setRecords] = useState<RecordItem[]>(() =>
    readStored("rebear-records", []),
  )
  const [toast, setToast] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const cropRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    mode: "move" | "resize"
    sx: number
    sy: number
    initial: Crop
  } | null>(null)

  const allFabrics = useMemo(() => [...fabrics, ...sampleFabrics], [fabrics])

  useEffect(
    () => localStorage.setItem("rebear-fabrics", JSON.stringify(fabrics)),
    [fabrics],
  )
  useEffect(
    () => localStorage.setItem("rebear-design", JSON.stringify(assignments)),
    [assignments],
  )
  useEffect(
    () => localStorage.setItem("rebear-records", JSON.stringify(records)),
    [records],
  )
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const go = (next: Screen, replace = false) => {
    if (!replace) setHistory((h) => [...h, screen])
    setScreen(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const back = () => {
    const previous = history.at(-1) ?? "home"
    setHistory((h) => h.slice(0, -1))
    setScreen(previous)
  }

  const loadFile = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setToast("请选择 JPG 或 PNG 图片")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPendingImage(String(reader.result))
      setCrop({ x: 20, y: 15, w: 60, h: 70 })
      setDialog(false)
      go("crop")
    }
    reader.readAsDataURL(file)
  }

  const editFabric = (fabric: Fabric) => {
    setEditingId(fabric.id)
    setPendingImage(fabric.image)
    setWidth(fabric.width)
    setHeight(fabric.height)
    setCrop(fabric.crop ?? { x: 10, y: 10, w: 80, h: 80 })
    go("crop")
  }

  const createCroppedImage = () =>
    new Promise<string>((resolve) => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement("canvas")
        const sx = (crop.x / 100) * image.naturalWidth
        const sy = (crop.y / 100) * image.naturalHeight
        const sw = (crop.w / 100) * image.naturalWidth
        const sh = (crop.h / 100) * image.naturalHeight
        canvas.width = Math.min(900, Math.max(180, Math.round(sw)))
        canvas.height = Math.min(900, Math.max(180, Math.round(sh)))
        canvas
          .getContext("2d")
          ?.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", 0.82))
      }
      image.onerror = () => resolve(pendingImage)
      image.src = pendingImage
    })

  const saveFabric = async () => {
    if (!pendingImage || width <= 0 || height <= 0) {
      setToast("请添加照片和有效尺寸")
      return
    }
    const image = await createCroppedImage()
    if (editingId) {
      setFabrics((items) =>
        items.map((f) =>
          f.id === editingId ? { ...f, image, width, height, crop } : f,
        ),
      )
    } else {
      setFabrics((items) => [
        {
          id: `fabric-${Date.now()}`,
          name: `布料 ${String(items.length + 1).padStart(2, "0")}`,
          image,
          width,
          height,
          crop,
        },
        ...items,
      ])
    }
    setEditingId(null)
    setPendingImage("")
    go("fabrics", true)
    setToast("布料已保存")
  }

  const deleteFabric = () => {
    if (!deleteId) return
    setFabrics((items) => items.filter((item) => item.id !== deleteId))
    setAssignments(
      (current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([, fabricId]) => fabricId !== deleteId,
          ),
        ) as Assignments,
    )
    setDeleteId(null)
    setToast("布料已删除")
  }

  const startUpload = () => {
    setEditingId(null)
    setPendingImage("")
    go("upload")
    window.setTimeout(() => setDialog(true), 180)
  }

  const assignFabric = (fabricId: string) => {
    setAssignments((current) => {
      const next = { ...current }
      if (next[selectedPart] === fabricId) delete next[selectedPart]
      else next[selectedPart] = fabricId
      return next
    })
  }

  const saveRecord = () => {
    const item: RecordItem = {
      id: `bear-${Date.now()}`,
      createdAt: new Date().toISOString(),
      assignments,
    }
    setRecords((current) => [item, ...current])
    setToast("小熊设计已保存")
  }

  const onCropPointerDown = (
    event: React.PointerEvent,
    mode: "move" | "resize",
  ) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      mode,
      sx: event.clientX,
      sy: event.clientY,
      initial: crop,
    }
  }
  const onCropPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current
    const box = cropRef.current
    if (!drag || !box) return
    const dx = ((event.clientX - drag.sx) / box.clientWidth) * 100
    const dy = ((event.clientY - drag.sy) / box.clientHeight) * 100
    if (drag.mode === "move") {
      setCrop({
        ...drag.initial,
        x: Math.max(0, Math.min(100 - drag.initial.w, drag.initial.x + dx)),
        y: Math.max(0, Math.min(100 - drag.initial.h, drag.initial.y + dy)),
      })
    } else {
      setCrop({
        ...drag.initial,
        w: Math.max(20, Math.min(100 - drag.initial.x, drag.initial.w + dx)),
        h: Math.max(20, Math.min(100 - drag.initial.y, drag.initial.h + dy)),
      })
    }
  }

  const assignedFabric = (part: Part) =>
    allFabrics.find((fabric) => fabric.id === assignments[part])
  const assignedCount = Object.keys(assignments).length

  const renderHome = () => (
    <main className="home-screen screen">
      <ArtCrop className="brand-art" x={50} y={91} w={192} h={58} />
      <p className="tagline">Give old clothes a new life.</p>
      <ArtCrop className="home-art" x={31} y={196} w={231} h={215} />
      <section className="home-copy">
        <h1>
          让旧衣服变成
          <br />
          独一无二的布偶小熊
        </h1>
        <p>用布料与创意，创造专属小熊。</p>
      </section>
      <button className="primary" onClick={() => go("upload")}>
        开始制作 →
      </button>
      <BottomNav active="home" go={go} />
    </main>
  )

  const renderUpload = () => (
    <main className="screen content-screen">
      <BackHeader title="添加布料" onBack={back} />
      <div className="intro">
        <div>
          <span>STEP 1 / 3</span>
          <h2>准备你的小熊布料</h2>
          <p>上传旧衣服照片，标记可以使用的区域。</p>
        </div>
        <ArtCrop
          className="intro-bear"
          x={413.21}
          y={90.74}
          w={65}
          h={72}
          sourceW={1218.286}
        />
      </div>
      <button className="upload-zone" onClick={() => setDialog(true)}>
        {pendingImage ? (
          <img src={pendingImage} alt="已选择的布料" />
        ) : (
          <>
            <strong>＋</strong>
            <b>上传照片</b>
            <span>（支持 JPG / PNG）</span>
          </>
        )}
      </button>
      <div className="or">— 或 —</div>
      <button
        className="secondary"
        onClick={() => {
          setDialog(true)
        }}
      >
        ＋ 从相册选择
      </button>
      <button
        className="primary"
        onClick={() => (pendingImage ? go("crop") : setDialog(true))}
      >
        下一步 →
      </button>
    </main>
  )

  const renderCrop = () => (
    <main className="screen content-screen crop-screen">
      <BackHeader title="裁剪布料" onBack={back} />
      <div
        className="crop-editor"
        ref={cropRef}
        onPointerMove={onCropPointerMove}
        onPointerUp={() => (dragRef.current = null)}
      >
        <img src={pendingImage} alt="待裁剪布料" draggable={false} />
        <div
          className="crop-box"
          style={{
            left: `${crop.x}%`,
            top: `${crop.y}%`,
            width: `${crop.w}%`,
            height: `${crop.h}%`,
          }}
          onPointerDown={(e) => onCropPointerDown(e, "move")}
        >
          <i className="handle tl" />
          <i className="handle tr" />
          <i className="handle bl" />
          <i
            className="handle br"
            onPointerDown={(e) => {
              e.stopPropagation()
              onCropPointerDown(e, "resize")
            }}
          />
        </div>
      </div>
      <p className="crop-hint">✦　拖动区域可作为输入范围</p>
      <h2 className="size-title">储存尺寸</h2>
      <label className="dimension">
        布料宽度（cm）
        <input
          aria-label="布料宽度"
          type="number"
          min="1"
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
        />
      </label>
      <label className="dimension">
        布料高度（cm）
        <input
          aria-label="布料高度"
          type="number"
          min="1"
          value={height}
          onChange={(e) => setHeight(Number(e.target.value))}
        />
      </label>
      <button className="primary" onClick={saveFabric}>
        保存布料
      </button>
      <button className="text-button" onClick={back}>
        取消编辑
      </button>
    </main>
  )

  const renderFabrics = () => (
    <main className="screen content-screen fabrics-screen">
      <BackHeader title="我的布料" onBack={back} />
      <div className="filters">
        <button className="active">全部</button>
        <button onClick={() => setToast("已显示布料")}>布料</button>
        <button onClick={() => setToast("已显示旧衣")}>旧衣</button>
      </div>
      <div className="fabric-grid">
        {fabrics.map((fabric) => (
          <article className="fabric-card" key={fabric.id}>
            <FabricImage fabric={fabric} />
            <div className="fabric-actions">
              <button
                aria-label={`删除${fabric.name}`}
                onClick={() => setDeleteId(fabric.id)}
              >
                <Icon name="52b05" />
              </button>
              <button
                aria-label={`编辑${fabric.name}`}
                onClick={() => editFabric(fabric)}
              >
                <Icon name="ad5f3" />
              </button>
            </div>
          </article>
        ))}
        <button className="add-fabric" onClick={startUpload}>
          <strong>＋</strong>
          <span>添加布料</span>
        </button>
        {sampleFabrics
          .slice(0, Math.max(0, 5 - fabrics.length))
          .map((fabric) => (
            <article className="fabric-card sample-card" key={fabric.id}>
              <FabricImage fabric={fabric} />
            </article>
          ))}
      </div>
      <button className="primary" onClick={() => go("design")}>
        开始设计小熊
      </button>
      <button className="text-button" onClick={back}>
        取消编辑
      </button>
    </main>
  )

  const renderDesign = () => (
    <main className="screen content-screen design-screen">
      <BackHeader title="设计你的小熊" onBack={back} />
      <div className="design-intro">
        <span>STEP 2 / 2</span>
        <h2>把想法 摆到布料上</h2>
        <p>选择部位，搭配不同布料，打造独一无二的小熊。</p>
      </div>
      <div className="bear-preview">
        <ArtCrop x={298} y={772} w={222} h={133} />
        {parts.map(({ id }) => {
          const fabric = assignedFabric(id)
          return fabric ? (
            <div
              key={id}
              className={`bear-patch patch-${id}`}
              style={{ backgroundImage: `url("${fabric.image}")` }}
            />
          ) : null
        })}
      </div>
      <div className="part-tabs">
        {parts.map((part) => (
          <button
            key={part.id}
            className={selectedPart === part.id ? "active" : ""}
            onClick={() => setSelectedPart(part.id)}
          >
            {part.label}
          </button>
        ))}
      </div>
      <div className="assignment-title">
        <h3>{parts.find((p) => p.id === selectedPart)?.label}布料</h3>
        <span>
          {assignedCount} / {parts.length} 已分配
        </span>
      </div>
      <div className="assignment-row">
        {allFabrics.slice(0, 5).map((fabric) => (
          <button
            key={fabric.id}
            aria-label={`选择${fabric.name}`}
            className={
              assignments[selectedPart] === fabric.id ? "selected" : ""
            }
            onClick={() => assignFabric(fabric.id)}
          >
            <FabricImage fabric={fabric} />
          </button>
        ))}
      </div>
      <div className="design-actions">
        <button
          className="secondary"
          onClick={() => {
            localStorage.setItem("rebear-design", JSON.stringify(assignments))
            go("home")
          }}
        >
          保存并退出
        </button>
        <button
          className="primary"
          onClick={() => {
            if (!assignedCount) setToast("请至少分配一种布料")
            else {
              setGuideStep(0)
              go("guide")
            }
          }}
        >
          确认设计
        </button>
      </div>
    </main>
  )

  const guideContent = [
    {
      title: "把想法 摆到布料上",
      copy: "根据图纸，将裁片拖拽至布料区域。",
      crop: [556, 783, 211, 162],
    },
    {
      title: "沿着轮廓 仔细裁剪",
      copy: "固定纸样，沿外缘预留缝份后裁剪。",
      crop: [556, 783, 211, 162],
    },
    {
      title: "配对裁片 开始缝制",
      copy: "核对每组裁片，标记正反面与对应部位。",
      crop: [556, 783, 211, 162],
    },
  ] as const
  const guide = guideContent[guideStep]

  const renderGuide = () => (
    <main className="screen content-screen guide-screen">
      <BackHeader title="制作指南" onBack={back} />
      <div className="guide-copy">
        <span>STEP {guideStep + 1} / 3</span>
        <h2>{guide.title}</h2>
        <p>{guide.copy}</p>
      </div>
      <ArtCrop
        className="guide-art"
        x={guide.crop[0]}
        y={guide.crop[1]}
        w={guide.crop[2]}
        h={guide.crop[3]}
      />
      <b className="cut-note">裁片说明：放置仅作轮廓展示</b>
      <div className="cut-list">
        {parts.map((part) => (
          <span key={part.id}>
            {part.label} × {part.quantity}
          </span>
        ))}
      </div>
      <div className="progress" aria-label={`第${guideStep + 1}步`}>
        {guideContent.map((_, i) => (
          <i key={i} className={i <= guideStep ? "active" : ""} />
        ))}
      </div>
      <div className="guide-actions">
        <button
          className="secondary"
          onClick={() => (guideStep ? setGuideStep((s) => s - 1) : back())}
        >
          上一步
        </button>
        <button
          className="primary"
          onClick={() =>
            guideStep < 2 ? setGuideStep((s) => s + 1) : go("complete")
          }
        >
          {guideStep < 2 ? "下一步" : "完成制作"}
        </button>
      </div>
    </main>
  )

  const renderComplete = () => (
    <main className="screen content-screen complete-screen">
      <button className="back complete-back" onClick={back}>
        <Icon name="47cb2" /> 返回
      </button>
      <ArtCrop className="complete-title" x={821} y={690} w={196} h={79} />
      <ArtCrop className="complete-bear" x={806} y={770} w={231} h={195} />
      <button className="primary" onClick={saveRecord}>
        保存到相册
      </button>
      <button
        className="secondary"
        onClick={() => {
          setAssignments({})
          setPendingImage("")
          setHistory([])
          setScreen("home")
        }}
      >
        再做一个
      </button>
      <ArtCrop className="complete-bottom" x={801} y={1075} w={240} h={56} />
    </main>
  )

  const renderCollectionPage = (kind: "favorites" | "records") => {
    const isRecords = kind === "records"
    return (
      <main className="screen content-screen collection-screen">
        <h1>{isRecords ? "制作记录" : "我的收藏"}</h1>
        <ArtCrop className="collection-bear" x={806} y={770} w={231} h={195} />
        {isRecords && records.length ? (
          <div className="record-list">
            {records.map((record, index) => (
              <button
                key={record.id}
                onClick={() => {
                  setAssignments(record.assignments)
                  go("design")
                }}
              >
                <b>专属小熊 {records.length - index}</b>
                <span>
                  {new Date(record.createdAt).toLocaleDateString("zh-CN")}
                </span>
                <em>›</em>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-card">
            <b>{isRecords ? "还没有制作记录" : "还没有收藏的小熊"}</b>
            <p>完成第一只专属小熊后，它会出现在这里。</p>
            <button className="primary" onClick={() => go("upload")}>
              开始制作
            </button>
          </div>
        )}
        <BottomNav active={kind} go={go} />
      </main>
    )
  }

  const renderProfile = () => (
    <main className="screen content-screen profile-screen">
      <button className="settings" onClick={() => setToast("设置已打开")}>
        ⚙
      </button>
      <div className="profile-head">
        <ArtCrop x={1070} y={684} w={69} h={72} />
        <div>
          <h1>ReBear</h1>
          <p>ID: 10086</p>
        </div>
      </div>
      <div className="profile-menu">
        <button onClick={() => go("fabrics")}>
          <Icon name="581c5" />
          我的布料 <span>›</span>
        </button>
        <button onClick={() => go("favorites")}>
          <span className="menu-bear">♧</span>我的小熊 <span>›</span>
        </button>
        <button onClick={() => go("records")}>
          <Icon name="c5179" />
          制作记录 <span>›</span>
        </button>
        <button onClick={() => setToast("帮助中心已打开")}>
          <span>?</span>使用帮助 <span>›</span>
        </button>
        <button onClick={() => setToast("ReBear · 让旧衣服重获新生")}>
          <span>!</span>关于 ReBear <span>›</span>
        </button>
      </div>
      <ArtCrop className="profile-bottom" x={1062} y={1022} w={231} h={74} />
      <BottomNav active="profile" go={go} />
    </main>
  )

  return (
    <div className="app-shell">
      <StatusBar />
      <div className="screen-transition" key={screen}>
        {screen === "home" && renderHome()}
        {screen === "upload" && renderUpload()}
        {screen === "crop" && renderCrop()}
        {screen === "fabrics" && renderFabrics()}
        {screen === "design" && renderDesign()}
        {screen === "guide" && renderGuide()}
        {screen === "complete" && renderComplete()}
        {screen === "favorites" && renderCollectionPage("favorites")}
        {screen === "records" && renderCollectionPage("records")}
        {screen === "profile" && renderProfile()}
      </div>
      {dialog && (
        <div
          className="modal-layer"
          role="dialog"
          aria-modal="true"
          aria-label="选择照片来源"
        >
          <button
            className="modal-scrim"
            onClick={() => setDialog(false)}
            aria-label="关闭弹窗"
          />
          <div className="source-dialog">
            <ArtCrop x={698} y={218} w={59} h={45} />
            <h2>选择照片来源</h2>
            <button onClick={() => cameraRef.current?.click()}>
              ▣　拍摄照片
            </button>
            <button onClick={() => fileRef.current?.click()}>
              ▧　从相册选择
            </button>
            <button className="cancel" onClick={() => setDialog(false)}>
              取消
            </button>
          </div>
        </div>
      )}
      {deleteId && (
        <div
          className="modal-layer"
          role="dialog"
          aria-modal="true"
          aria-label="删除布料"
        >
          <button
            className="modal-scrim"
            onClick={() => setDeleteId(null)}
            aria-label="关闭弹窗"
          />
          <div className="delete-dialog">
            <h2>删除这块布料？</h2>
            <p>删除后，已分配给小熊的对应区域也会被清除。</p>
            <button className="primary" onClick={deleteFabric}>
              确认删除
            </button>
            <button className="secondary" onClick={() => setDeleteId(null)}>
              保留布料
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <input
        ref={fileRef}
        hidden
        type="file"
        accept="image/jpeg,image/png"
        onChange={(e) => loadFile(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => loadFile(e.target.files?.[0])}
      />
    </div>
  )
}

export default App
