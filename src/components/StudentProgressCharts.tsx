import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';

interface ExamData {
  examName: string;
  puan: number;
  netTotal: number;
}

interface StudentProgressChartsProps {
  examList: ExamData[];
  resultDetails: any;
}

const getDisplayLessonName = (name: string): string => {
  if (!name || name.trim() === '') return '';
  const normalized = name.toLowerCase().replace(/i̇/g, 'i').replace(/ı/g, 'i');
  if (normalized.includes('toplam') || normalized.includes('genel') || normalized.includes('puan') || normalized.includes('sinif') || normalized.includes('okul') || normalized.includes('sira')) return '';
  return name.trim();
};

const getNet = (l: any) => {
  if (l === null || l === undefined) return 0;
  if (typeof l === 'number') return l;
  if (typeof l.N === 'number') return l.N;
  if (typeof l.n === 'number') return l.n;
  if (typeof l.net === 'number') return l.net;
  return parseFloat(l.N || l.n || l.net || '0') || 0;
};

export const StudentProgressCharts: React.FC<StudentProgressChartsProps> = ({ examList, resultDetails }) => {
  const overallChartRef = useRef<HTMLDivElement>(null);
  const subjectsChartRef = useRef<HTMLDivElement>(null);

  // Process data for charts
  const { overallData, subjectsData, allSubjects } = useMemo(() => {
    const overall = examList.map((ex, i) => ({
      index: i,
      examName: ex.examName,
      netTotal: ex.netTotal,
      puan: ex.puan
    }));

    const subjectMap: Record<string, { examName: string, net: number, index: number }[]> = {};
    
    examList.forEach((ex, i) => {
      const detail = resultDetails?.[ex.examName];
      if (detail && detail.lessons) {
        let parsedLessons: any[] = [];
        if (Array.isArray(detail.lessons)) {
           parsedLessons = detail.lessons;
        } else {
           parsedLessons = Object.entries(detail.lessons).map(([name, data]: [string, any]) => ({ name, ...data }));
        }

        const processed = new Set<string>();
        parsedLessons.forEach(l => {
          const stdName = getDisplayLessonName(l.name || l.lessonName || '');
          if (stdName && !processed.has(stdName)) {
            processed.add(stdName);
            const netVal = getNet(l);
            if (!subjectMap[stdName]) subjectMap[stdName] = [];
            subjectMap[stdName].push({ examName: ex.examName, net: netVal, index: i });
          }
        });
      }
    });

    const CORE_LESSONS = ["Türkçe", "Matematik", "Fen Bilimleri", "İnkılap Tarihi", "Din Kültürü", "İngilizce"];
    const filteredSubjects = Object.keys(subjectMap).filter(s => {
       const lowerS = s.toLowerCase();
       return CORE_LESSONS.some(cl => cl.toLowerCase() === lowerS) || Object.keys(subjectMap).length <= 6;
    }).slice(0, 8); // Limit to top 8 subjects to avoid clutter

    return { overallData: overall, subjectsData: subjectMap, allSubjects: filteredSubjects };
  }, [examList, resultDetails]);

  useEffect(() => {
    if (!overallChartRef.current || overallData.length === 0) return;
    
    d3.select(overallChartRef.current).selectAll("*").remove();

    const width = overallChartRef.current.clientWidth || 600;
    const height = 240;
    const margin = { top: 20, right: 30, bottom: 40, left: 40 };

    const svg = d3.select(overallChartRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("max-width", "100%")
      .style("height", "auto")
      .style("font-family", "Inter, sans-serif");

    const x = d3.scalePoint()
      .domain(overallData.map(d => d.examName))
      .range([margin.left, width - margin.right])
      .padding(0.5);

    const maxNet = Number(d3.max(overallData, (d: any) => d.netTotal)) || 100;
    const y = d3.scaleLinear()
      .domain([0, maxNet * 1.1])
      .range([height - margin.bottom, margin.top]);

    // Grid lines
    svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-width + margin.left + margin.right).tickFormat(() => ""))
      .style("stroke-dasharray", "3,3")
      .style("stroke-opacity", 0.1);

    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("font-size", "10px")
      .style("color", "#5a5a40")
      .attr("transform", "translate(0,5) rotate(-15)");

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .style("font-size", "10px")
      .style("color", "#5a5a40");

    // Line
    const line = d3.line<any>()
      .x((d: any) => x(d.examName)!)
      .y((d: any) => y(d.netTotal))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(overallData)
      .attr("fill", "none")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 3)
      .attr("d", line);

    // Dots
    svg.selectAll(".dot")
      .data(overallData)
      .enter().append("circle")
      .attr("class", "dot")
      .attr("cx", (d: any) => x(d.examName)!)
      .attr("cy", (d: any) => y(d.netTotal))
      .attr("r", 5)
      .attr("fill", "#fff")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 2);

    // Tooltip
    const tooltip = d3.select(overallChartRef.current).append("div")
      .style("position", "absolute")
      .style("opacity", 0)
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "#fff")
      .style("padding", "6px 10px")
      .style("border-radius", "4px")
      .style("font-size", "11px")
      .style("pointer-events", "none")
      .style("transform", "translate(-50%, -100%)")
      .style("margin-top", "-10px");

    svg.selectAll(".dot-interactive")
      .data(overallData)
      .enter().append("circle")
      .attr("class", "dot-interactive")
      .attr("cx", (d: any) => x(d.examName)!)
      .attr("cy", (d: any) => y(d.netTotal))
      .attr("r", 15)
      .attr("fill", "transparent")
      .on("mouseover", (event, d: any) => {
        d3.select(event.currentTarget.previousSibling as Element).attr("r", 7).attr("fill", "#10b981");
        tooltip.transition().duration(200).style("opacity", 1);
        tooltip.html(`<strong>${d.examName}</strong><br/>Toplam Net: ${d.netTotal.toFixed(2)}<br/>Puan: ${d.puan.toFixed(2)}`)
          .style("left", (event.pageX) + "px")
          .style("top", (event.pageY) + "px");
      })
      .on("mouseout", (event) => {
        d3.select(event.currentTarget.previousSibling as Element).attr("r", 5).attr("fill", "#fff");
        tooltip.transition().duration(500).style("opacity", 0);
      });

  }, [overallData]);

  useEffect(() => {
    if (!subjectsChartRef.current || allSubjects.length === 0 || overallData.length === 0) return;
    
    d3.select(subjectsChartRef.current).selectAll("*").remove();

    const width = subjectsChartRef.current.clientWidth || 600;
    const height = 240;
    const margin = { top: 20, right: 120, bottom: 40, left: 40 };

    const svg = d3.select(subjectsChartRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("max-width", "100%")
      .style("height", "auto")
      .style("font-family", "Inter, sans-serif");

    const x = d3.scalePoint()
      .domain(overallData.map(d => d.examName))
      .range([margin.left, width - margin.right])
      .padding(0.5);

    let maxNet = 20; // default for core subjects
    allSubjects.forEach(s => {
       const m = d3.max(subjectsData[s] || [], (d: any) => d.net) || 0;
       if (Number(m) > maxNet) maxNet = Number(m);
    });

    const y = d3.scaleLinear()
      .domain([-5, maxNet * 1.1])
      .range([height - margin.bottom, margin.top]);

    // Color scale
    const color = d3.scaleOrdinal<string>()
      .domain(allSubjects)
      .range(["#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#10b981", "#ec4899", "#14b8a6", "#64748b"]);

    // Grid lines
    svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-width + margin.left + margin.right).tickFormat(() => ""))
      .style("stroke-dasharray", "3,3")
      .style("stroke-opacity", 0.1);

    // Axes
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("font-size", "10px")
      .style("color", "#5a5a40")
      .attr("transform", "translate(0,5) rotate(-15)");

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .style("font-size", "10px")
      .style("color", "#5a5a40");

    const tooltip = d3.select(subjectsChartRef.current).append("div")
      .style("position", "absolute")
      .style("opacity", 0)
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "#fff")
      .style("padding", "6px 10px")
      .style("border-radius", "4px")
      .style("font-size", "11px")
      .style("pointer-events", "none")
      .style("transform", "translate(-50%, -100%)")
      .style("margin-top", "-10px");

    // Draw lines for each subject
    allSubjects.forEach(subject => {
      const data = subjectsData[subject];
      if (!data || data.length === 0) return;

      const line = d3.line<any>()
        .x((d: any) => x(d.examName)!)
        .y((d: any) => y(d.net))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", color(subject))
        .attr("stroke-width", 2.5)
        .attr("d", line);

      svg.selectAll(`.dot-${subject.replace(/\s+/g, '-')}`)
        .data(data)
        .enter().append("circle")
        .attr("class", `dot-${subject.replace(/\s+/g, '-')}`)
        .attr("cx", (d: any) => x(d.examName)!)
        .attr("cy", (d: any) => y(d.net))
        .attr("r", 4)
        .attr("fill", "#fff")
        .attr("stroke", color(subject))
        .attr("stroke-width", 2)
        .on("mouseover", (event, d: any) => {
          d3.select(event.currentTarget).attr("r", 6).attr("fill", color(subject));
          tooltip.transition().duration(200).style("opacity", 1);
          tooltip.html(`<strong>${subject}</strong><br/>${d.examName}: ${d.net.toFixed(2)} Net`)
            .style("left", (event.pageX) + "px")
            .style("top", (event.pageY) + "px");
        })
        .on("mouseout", (event) => {
          d3.select(event.currentTarget).attr("r", 4).attr("fill", "#fff");
          tooltip.transition().duration(500).style("opacity", 0);
        });
    });

    // Legend
    const legend = svg.append("g")
      .attr("transform", `translate(${width - margin.right + 10}, 20)`);

    allSubjects.forEach((subject, i) => {
      const legendRow = legend.append("g")
        .attr("transform", `translate(0, ${i * 20})`);
      
      legendRow.append("rect")
        .attr("width", 10)
        .attr("height", 10)
        .attr("fill", color(subject));

      legendRow.append("text")
        .attr("x", 16)
        .attr("y", 9)
        .style("font-size", "10px")
        .style("font-weight", "600")
        .style("fill", "#5a5a40")
        .text(subject.length > 12 ? subject.substring(0, 10) + '...' : subject);
    });

  }, [allSubjects, subjectsData, overallData]);

  if (overallData.length === 0) return null;

  return (
    <div className="space-y-6 mt-6 no-print">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-sm">
          <h4 className="font-bold text-[#5a5a40] text-sm mb-4">Genel Başarı Durumu (Toplam Net)</h4>
          <div className="relative w-full" ref={overallChartRef}></div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-sm">
          <h4 className="font-bold text-[#5a5a40] text-sm mb-4">Ders Bazlı Gelişim Trendleri</h4>
          <div className="relative w-full" ref={subjectsChartRef}></div>
        </div>
      </div>
    </div>
  );
};
