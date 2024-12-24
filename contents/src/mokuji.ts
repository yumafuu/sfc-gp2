const pagenumSpan = (size, i) => {
  return `<span class="right font-mid size-${size}"> ${i} </span>`
}

export const BuildMokuji = (titles) => {
  let content = "# 目次\n\n"
  for (let title of titles) {
    let [page, ver, str] = title

    // の数を数えて、その数だけ`#`をつける
    const size = ver.split(".").length
    const hprefix = `#`.repeat(size + 1)
    if (size === 1) {
      ver = `第${ver}章`
    }

    content += `${hprefix} ${ver}${str}${pagenumSpan(size, page)}\n\n`
  }

  return content
}
