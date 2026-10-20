from pathlib import Path
import shutil, zipfile

root=Path(__file__).parent/'Lataksh_Sariya_EE24BT018_Exp8'
images=root/'images'; images.mkdir(exist_ok=True)
names=['b2e786bf-02e0-4ac2-b976-65c1b378f55f','30a435e9-20de-425e-a15f-eb567694a20e','479ef226-109b-424a-ad43-e0880796bd3c','b6a96a19-c961-4e1e-b283-59f25e4f16bd','6f82baa6-2171-4afe-ab8f-03e778566112','e306f340-af2a-4bde-a756-8eb5f90d4149','c1bb05a5-1633-4577-937b-a42aecbfef0a','ec24a36e-c20c-4108-8b68-8c83805d6059','25f6d583-20db-46d9-bdde-11cc07d1eac7','03c97a98-c1cf-454e-8350-35b0e5520e09']
for i,n in enumerate(names,1): shutil.copyfile(Path('C:/Users/latak/AppData/Local/Temp')/f'codex-clipboard-{n}.jpg',images/f'photo{i:02}.jpg')
shutil.copyfile(Path(__file__).parent/'source/images/manual_circuit.jpg',images/'manual_circuit.jpg')
tex=r'''\documentclass[11pt,a4paper]{article}
\usepackage[margin=19mm,headheight=14pt]{geometry}
\usepackage{amsmath,amssymb,graphicx,booktabs,tabularx,array,caption,fancyhdr,hyperref}
\hypersetup{colorlinks=true,urlcolor=blue,linkcolor=black,pdftitle={Experiment 8 Buck Converter},pdfauthor={Lataksh Sariya EE24BT018}}
\pagestyle{fancy}\fancyhf{}\lhead{Experiment 8\quad Buck Converter}\rhead{EE24BT018}\cfoot{\thepage}
\renewcommand{\headrulewidth}{0pt}
\setlength{\parindent}{0pt}\setlength{\parskip}{5pt}
\renewcommand{\arraystretch}{1.18}
\newcommand{\uF}{\,\mu\mathrm{F}}
\newcommand{\mH}{\,\mathrm{mH}}
\newcommand{\photo}[3]{\begin{center}\includegraphics[width=\linewidth,height=#2,keepaspectratio]{images/photo#1.jpg}\captionof{figure}{#3}\end{center}}
\begin{document}
\begin{center}
{\Large\bfseries Experiment 8}\\[5pt]
{\LARGE\bfseries Design and Implementation of a Buck Converter}\\[9pt]
{\large Lataksh Sariya\quad |\quad EE24BT018}\\[3pt]
Digital Power Conversion Laboratory
\end{center}

\section*{1\quad Objective}
To design a PWM buck converter for a nominal output of 10 V at 100 W, determine the duty ratio, load resistance, inductance and capacitance theoretically, and compare the design with laboratory evidence obtained using a practical inductance of $0.95\mH$.

\section*{2\quad Specifications and apparatus}
\begin{tabularx}{\linewidth}{@{}XlXl@{}}\toprule
Parameter & Specification & Parameter & Specification\\\midrule
Input voltage & 15--25 V & Nominal input & 20 V\\
Output voltage & 10 V & Switching frequency & 25 kHz\\
Nominal output power & 100 W & Current ripple & 0.2 A\\
Output voltage ripple & 0.1 V & Practical inductance & 0.95 mH\\
MOSFET & IRF540N & Diode & Fast recovery\\
Gate resistor $R_2$ & $5\,\Omega$ & Gate pull-down $R_3$ & $1\,\mathrm{k}\Omega$\\\bottomrule
\end{tabularx}

The ripple specifications are interpreted as peak-to-peak values. The apparatus comprises a TL494 PWM module, MOSFET and diode power stage, inductor, output capacitor, adjustable resistive load, DC supply, Tektronix TBS1072C oscilloscope, DC ammeter and multimeter. The installed capacitor value and actual load setting are not legible in the photographs.

\section*{3\quad Principle and theoretical calculations}
The following derivation assumes ideal components, steady state, continuous conduction mode (CCM), negligible capacitor ESR, and regulated $V_o=10$ V. During switch ON, $v_L=V_{in}-V_o$ and $i_L$ rises; during OFF, the diode carries the inductor current and $v_L=-V_o$. Inductor volt-second balance gives
\[
D(V_{in}-V_o)+(1-D)(-V_o)=0
\quad\Longrightarrow\quad \boxed{V_o=DV_{in}}.
\]
At the nominal point,
\[
\boxed{D=\frac{10}{20}=0.50},\qquad
T_s=\frac1{25000}=40\,\mu\mathrm{s},\qquad
t_{on}=t_{off}=20\,\mu\mathrm{s}.
\]
The nominal output current and load are
\[
\boxed{I_o=\frac{100}{10}=10\,\mathrm{A}},\qquad
\boxed{R_1=\frac{V_o^2}{P_o}=\frac{10^2}{100}=1\,\Omega}.
\]
The load must dissipate 100 W continuously at this design point, with suitable thermal margin. The ideal average input current is $P_o/V_{in}=5$ A at 20 V. These are design targets, not measured laboratory results.

\newpage
\section*{4\quad Inductor and capacitor design}
From the ON-interval current rise,
\[
\Delta I_{L,pp}=\frac{(V_{in}-V_o)D}{Lf_s}
=\frac{V_o(1-D)}{Lf_s}.
\]
At the nominal input, the inductance for $0.2$ A peak-to-peak ripple is
\[
L=\frac{(20-10)(0.5)}{(0.2)(25000)}
=0.001\,\mathrm{H}=\boxed{1.00\mH}.
\]
For triangular capacitor current, neglecting ESR,
\[
\Delta V_{o,pp}\simeq\frac{\Delta I_{L,pp}}{8f_s C_1}
\quad\Longrightarrow\quad
C_{1,min}=\frac{0.2}{8(25000)(0.1)}=\boxed{10\uF}.
\]
This is the ideal minimum, with no allowance for tolerance, ESR or transients. For a $1.2$ mH design, a $22\uF$ low-ESR capacitor is an illustrative choice: at the worst-case $0.2$ A ripple, its capacitive ripple is about 45.5 mV. The remaining 54.5 mV implies an approximate ESR ceiling of $0.273\,\Omega$ before other margins. This is a design illustration, not identification of the installed capacitor.

\subsection*{Design over the full input range}
To hold 10 V, the duty ratio must vary with input voltage. The largest ripple occurs at 25 V, requiring $L\geq1.20$ mH to satisfy the 0.2 A limit over the entire range.
\begin{center}\begin{tabular}{@{}rrrrr@{}}\toprule
$V_{in}$ (V)& $D$ & $t_{on}$ ($\mu$s)& $L_{min}$ (mH)& $\Delta I_{pp}$ at 0.95 mH (A)\\\midrule
15 &0.6667&26.67&0.667&0.1404\\
20 &0.5000&20.00&1.000&0.2105\\
25 &0.4000&16.00&1.200&0.2526\\\bottomrule
\end{tabular}\end{center}

\subsection*{Predictions for the practical inductor}
For $L=0.95$ mH at 20 V and 25 kHz,
\[
\boxed{\Delta I_{L,pp}=0.2105\,\mathrm{A}},\qquad
\frac{0.2105-0.2}{0.2}\times100\%=5.26\%.
\]
At the 10 A design current, $I_{L,min}=9.8947$ A and $I_{L,max}=10.1053$ A. The nominal CCM boundary is $I_{o,crit}=\Delta I_{L,pp}/2=0.1053$ A, or $R_{crit}\approx95\,\Omega$. The inductor must retain its inductance near 10.11 A with saturation and thermal margin; its current rating is not established by its inductance alone.

The corresponding ideal capacitance minima are $10.53\uF$ at 20 V and $12.63\uF$ at 25 V. With $22\uF$, the predicted capacitive ripple is 47.8 mV nominal and 57.4 mV at 25 V; ESR, tolerances and switching spikes add to these values. The practical inductor therefore slightly exceeds the specified current ripple at nominal input even in the ideal model.

\newpage
\section*{5\quad PWM and expected waveforms}
The TL494 provides adjustable PWM. In single-ended operation its output frequency equals the oscillator frequency; in push-pull operation each output repeats at half the oscillator frequency. The approximate oscillator relation is $f_{osc}\simeq1/(R_T C_T)$; for example, $R_T=4\,\mathrm{k}\Omega$ and $C_T=10$ nF give 25 kHz in single-ended mode. These timing values are illustrative because the module settings are not visible.

\begin{tabularx}{\linewidth}{@{}p{25mm}X@{}}\toprule
Quantity & Expected ideal CCM behaviour\\\midrule
$v_{GS}$ & Gate pulses; high during the switch ON interval. Measure gate relative to source.\\
$v_{DS}$ & Approximately zero during ON and $V_{in}$ during OFF, with possible transition spikes.\\
Diode voltage & For anode-to-cathode polarity: approximately $-V_{in}$ during ON and near zero during OFF (about $+V_F$ for a real diode). Reversing the probe polarity reverses the trace.\\
$i_L$ & Continuous triangular waveform about $I_o$, rising during ON and falling during OFF. A current probe or known shunt is needed for an ampere scale.\\
$v_o$ & Nearly DC at 10 V, with small switching ripple.\\\bottomrule
\end{tabularx}

The sheet shows a low-side-switched buck arrangement: $Q_1$ switches the load return while the positive input rail is common to the inductor and diode cathode. During ON, the load return is near input negative; during OFF, it rises to approximately $V_{in}+V_F$ and the inductor current freewheels through the diode. The same volt-second balance applies. Here $V_o$ means the differential voltage across $R_1$ and $C_1$; it is not the upper output node measured relative to input negative. The actual probe connections are not shown.

\section*{6\quad Experimental method}
The laboratory implementation used the stated 0.95 mH inductor. The experimental checks are interpreted in the following sequence: establish the DC supply setting, identify the PWM waveform, examine the switching-voltage traces, and inspect the filtered output. The source sheet requests simultaneous gate pulses with $v_{DS}$, diode voltage, $i_L$ and $v_o$. The supplied scope photographs show CH2 only, with CH1 off; simultaneous phase comparison is consequently unavailable.

The clean rectangular trace in supplied Photo 10 is consistent with a gate-drive signal: its displayed frequency is 26.04 kHz, duty is 53.71\%, and maximum is 15.40 V. Its period and high time, calculated from those readings, are
\[
T=38.40\,\mu\mathrm{s},\qquad t_{on}=0.5371T=20.63\,\mu\mathrm{s}.
\]
The frequency is 4.16\% above the 25 kHz design target. The maximum is not an exact high-level measurement, and the probe reference is unknown, so this remains a probable gate waveform rather than a confirmed differential $v_{GS}$ capture.

At 20 V, that duty would give an ideal $V_o=10.742$ V. The separate likely output capture averages 10.12 V. Different captures need not share one operating point, so the 0.622 V difference cannot be assigned entirely to circuit losses. Using the measured frequency but retaining $D=0.5$ and $V_o=10$ V gives a theoretical ripple of $0.2021$ A with 0.95 mH; this is not a measured current ripple.

\newpage
\section*{7\quad Observations and interpretation}
Photo numbers below refer to the supplied attachment order and are retained in the figure captions.
\begin{tabularx}{\linewidth}{@{}p{11mm}p{34mm}X@{}}\toprule
Photo & Visible reading & Interpretation and limitation\\\midrule
10 &26.04 kHz; 53.71\%; max 15.40 V & Probable PWM gate signal; clean periodic pulses.\\
6 &Mean 10.12 V; max 20.80 V & Probable filtered output with ripple and narrow spikes. The mean is 1.2\% above 10 V; ripple compliance is unverified.\\
1, 2, 7, 8 &Repetitive voltage pulses with spikes & Switching-voltage family, consistent with a switching node, reversed diode voltage or MOSFET voltage. Exact node and polarity cannot be assigned.\\
9 &2 $\mu$s/div; max 44.80 V & Expanded switching edge with damped ringing; not an output-startup trace.\\
3 &CH1: 20.0 V, 2.51 A & Supply display; apparent input power 50.2 W if simultaneous voltage/current readback for the converter branch.\\
4 &Rheostat: 25 $\Omega$, 10 A marking & Component rating only; actual resistance setting is unknown.\\
5 &Needle near 42\% of full scale & Ammeter range/terminal cannot be established. A 5 A range would imply about 2.1 A, but this is not adopted as measured current.\\\bottomrule
\end{tabularx}

\textbf{Scope-reading checks.} Photos 2 and 7 show MHz frequency readings marked with question marks despite about one visible pulse period per 40 $\mu$s division. Photo 8 shows 25.19 kHz, but its 4.751\% duty reading is flagged and conflicts with the much wider visible high plateau. Photo 1 reports clipping and unavailable measurements. These automatic values are retained as evidence, not used as reliable PWM measurements. Photo 6's automatic 2.437 kHz and 54.68\% are inappropriate for establishing switching frequency or duty from a mostly DC waveform.

\textbf{Switching effects.} The narrow spikes and damped ringing are consistent with parasitic inductance/capacitance and switching transitions; diode recovery and probe-loop pickup may contribute. The pictures cannot isolate the cause. Maxima of 44--50 V include overshoot or pickup and should not be substituted for the steady pulse plateau. No calibrated triangular inductor-current trace is identifiable.

\section*{8\quad Result and conclusion}
The nominal theoretical design is $D=0.5$, $R_1=1\,\Omega$, $L=1.00$ mH and $C_{1,min}=10\uF$ under ideal assumptions. A minimum of 1.20 mH is needed for the specified current ripple over 15--25 V. The practical 0.95 mH predicts 0.2105 A ripple at nominal input. The photographs support PWM operation near 26 kHz and an output consistent with approximately 10 V. They do not establish the 0.1 V output ripple limit, inductor-current ripple, 100 W output operation or efficiency. The 50.2 W apparent supply input in Photo 3 cannot demonstrate 100 W output at that captured operating point.

{\footnotesize\textbf{References.} (1) Supplied laboratory sheet, \emph{DPC 2026 Experiment 8}, objective, specifications and capture requirements. (2) Texas Instruments, \emph{Basic Calculation of a Buck Converter's Power Stage}, \href{https://www.ti.com/lit/an/slva477b/slva477b.pdf}{SLVA477}, inductor and capacitor ripple relations. (3) Texas Instruments, \href{https://www.ti.com/lit/ds/symlink/tl494.pdf}{TL494 datasheet}, oscillator and output operating modes.}

\newpage
\section*{Appendix\quad Reference circuit}
\begin{center}
\includegraphics[width=\linewidth]{images/manual_circuit.jpg}
\captionof{figure}{Circuit reproduced from the supplied Experiment 8 laboratory sheet. Original labels and watermark are retained.}
\end{center}
This arrangement switches the lower load-return node using the N-channel MOSFET. The diode anode is connected to that switched return and its cathode to the positive input rail. The output capacitor and resistor are connected across the output, which floats relative to the input negative terminal during switching.

With the switch ON, the loop is supply--inductor--load--MOSFET. With the switch OFF, the inductor--load--diode loop maintains current. Consequently the inductor voltages are approximately $V_{in}-V_o$ and $-(V_o+V_F)$ respectively. Neglecting diode and switch drops recovers $V_o=DV_{in}$.

The resistor labelled $R_1$ is the power load calculated as $1\,\Omega$ at 100 W. $R_2=5\,\Omega$ is the series gate resistor, and $R_3=1\,\mathrm{k}\Omega$ is the gate pull-down. Their values are specified by the laboratory sheet; they are not calculated from the output power.

\textbf{Measurement interpretation.} A voltage trace referenced to input negative does not automatically represent the differential output voltage in this arrangement. This is why the signal names assigned to the supplied CH2-only captures remain probable identifications. Confirmed measurement of $v_o$ requires the voltage across $C_1$ or $R_1$; confirmed $i_L$ requires a current transducer or a calibrated shunt.

\newpage
\section*{Photographic evidence}
The original photographs are embedded below without waveform alteration. Captions identify inferred signals and preserve uncertainty about probe points. The instrument date shown is 06 October 2026; it is not independently verified as the experiment date.
\photo{10}{0.35\textheight}{Supplied Photo 10. Probable PWM gate-drive waveform: 5 V/div, 20 $\mu$s/div, 26.04 kHz, 53.71\% positive duty and 15.40 V maximum. CH1 is off.}
\photo{06}{0.35\textheight}{Supplied Photo 6. Probable filtered output: 10 V/div, 40 $\mu$s/div, mean 10.12 V and maximum 20.80 V. Narrow spikes are present; a 0.1 V ripple cannot be verified at this scale.}

\newpage
\section*{Switching-voltage captures}
\photo{08}{0.37\textheight}{Supplied Photo 8. Repetitive switching-voltage trace: 20 V/div, 40 $\mu$s/div, mean 9.273 V, maximum 44.00 V and displayed frequency 25.19 kHz. The flagged 4.751\% duty reading is inconsistent with the visible pulses.}
\photo{07}{0.37\textheight}{Supplied Photo 7. Switching-voltage trace with overshoot: 20 V/div, 40 $\mu$s/div, mean 11.54 V and maximum 49.60 V. The flagged 1.344 MHz frequency and 41.11\% duty are not used for design comparison.}

\newpage
\section*{Additional switching captures}
\photo{02}{0.37\textheight}{Supplied Photo 2. Switching-voltage trace: 10 V/div, 40 $\mu$s/div, mean 11.19 V and maximum 50.00 V. The flagged 1.029 MHz frequency conflicts with the visible repetition; the duty reading is also flagged.}
\photo{01}{0.37\textheight}{Supplied Photo 1. Switching-voltage trace: 20 V/div and 40 $\mu$s/div. Automatic measurements are unavailable and the scope indicates positive clipping. This capture is qualitative evidence only.}

\newpage
\section*{Expanded switching transition}
\photo{09}{0.52\textheight}{Supplied Photo 9. Expanded edge at 20 V/div and 2 $\mu$s/div, showing overshoot followed by damped high-frequency ringing. Displayed maximum is 44.80 V; the 5.403 MHz reading must not be identified as the converter switching frequency.}
The main transition occurs over a small fraction of one 25 kHz switching period. The ringing occupies microseconds after the edge. The displayed 53.31\% duty and 10.49 V mean belong to this short record and do not establish the duty or DC value of a complete switching cycle. Since this capture and the longer switching records do not show a probe label, an exact assignment to $v_{DS}$ or diode voltage would require information not present in the image.

\newpage
\section*{Supply and current instrumentation}
\photo{03}{0.37\textheight}{Supplied Photo 3. GW Instek GPD-3303D DC supply. CH1 displays 20.0 V and 2.51 A, with the CV indicator illuminated. Their product is 50.2 W if these are simultaneous converter input readbacks.}
\photo{05}{0.37\textheight}{Supplied Photo 5. DC ammeter with multiple scales and 25 A, 10 A and 5 A terminals. The pointer is approximately 42\% of full scale. The selected range is not sufficiently clear to report a unique current value.}

\newpage
\section*{Adjustable laboratory load}
\photo{04}{0.57\textheight}{Supplied Photo 4. Sliding rheostat with a 25 $\Omega$, 10 A label, and a handheld multimeter. The rheostat slider position does not establish its connected resistance. The meter display is approximately zero, but the measurement function and connections do not establish a load value.}
The theoretical $1\,\Omega$ load is obtained from the specified 10 V, 100 W operating point. The photograph verifies the presence of an adjustable power load but does not prove it was set to $1\,\Omega$. Thus the rated design current of 10 A must remain separate from any current inferred from the laboratory instruments.
\end{document}
'''
(root/'main.tex').write_text(tex,encoding='utf-8')
print(root)
