/**
 * Portfolio Data Source — Aldy Alfaisal Pasaribu
 * Extracted & cleaned from CV PDF.
 * Strict privacy policy:
 *  - NO private phone/WhatsApp number anywhere.
 *  - NO raw numeric GPA anywhere (permanently classified gimmick).
 */
export const PORTFOLIO_DATA = {
    profile: {
        name: 'Aldy Alfaisal Pasaribu',
        role: 'AI & Robotics Undergraduate',
        location: 'Tangerang, Indonesia',
        tagline: 'Bridging embedded IoT, computer vision, and human-centered software.',
        summary:
            'AI & Robotics undergraduate at Universitas Prasetiya Mulya experienced in embedded IoT systems, computer vision, machine learning pipelines, and hands-on hardware-software prototyping. Focused on translating engineering logic into reliable, human-centered intelligent systems.',
        contacts: {
            email: 'aldypasaribu59@gmail.com',
            github: 'https://github.com/Aldy-create',
            linkedin: 'https://www.linkedin.com/in/aldy-alfaisal-p-390bb1317/'
        }
    },

    education: {
        institution: 'Universitas Prasetiya Mulya',
        location: 'Tangerang, Indonesia',
        degree: 'Bachelor of Engineering in Artificial Intelligence & Robotics',
        shortDegree: 'B.Eng. in Artificial Intelligence & Robotics',
        period: 'Aug 2024 – Expected Aug 2028',
        gpaGimmick: {
            defaultBadge: 'GPA: [ CLASSIFIED 🔒 ]',
            pendingBadge: 'GPA: [ PENDING OFFER 📩 ]',
            triggerButton: 'Hire Me to Unlock',
            prompt: 'Nice try! Viewing my GPA requires an active Job Offer or Internship Invite.',
            hireButton: 'Hire / Send Offer 💼',
            forceButton: 'Just Snooping / Force Open 👀',
            hireReply:
                'Smart move! Opening your email client—GPA will be delivered straight to your inbox alongside my interview 😉',
            mailtoSubject: 'Unlocking Your GPA — Opportunity / Collaboration',
            forceReplies: [
                'Access denied. Clearance level: HRD / Tech Lead only 😎',
                'Clicking harder won’t decrypt the vault! Send an interview invite first 😉',
                'Impressive persistence! We’d clearly work great together—just hit that Hire button already!'
            ]
        }
    },

    projects: [
        {
            id: 'project-robotics',
            zoneTag: 'North-West Pad • Hardware & Embedded',
            shortTitle: 'WiFi Mobile Robot',
            title: 'WiFi-Controlled Mobile Robot',
            role: 'Hardware & Embedded Developer',
            period: 'Jan 2026 – Mar 2026',
            accent: '#41e8ff',
            techStack: [
                'C++',
                'ESP32',
                'Arduino',
                'MIT App Inventor',
                'Local WiFi (HTTP/UDP)'
            ],
            summary:
                'Differential drive mobile robot engineered on ESP32 with dual-motor PWM speed & steering control and a low-latency custom Android wireless controller.',
            highlights: [
                'Engineered a differential drive mobile robot powered by an ESP32 microcontroller with precision dual-motor PWM speed and steering control.',
                'Developed a custom Android teleoperation controller via MIT App Inventor communicating over a local WiFi network (HTTP/UDP) with low-latency responsiveness.'
            ]
        },
        {
            id: 'project-music',
            zoneTag: 'North Stage • Network Software',
            shortTitle: 'Music Stream App',
            title: 'Client-Server Music Stream App',
            role: 'Network Software Developer',
            period: 'Jan 2026 – Mar 2026',
            accent: '#ff7b3b',
            techStack: [
                'Python',
                'TCP/IP Socket Programming',
                'File I/O',
                'GUI Framework'
            ],
            summary:
                'TCP socket-based media streaming server and desktop client implementing a hybrid text-and-binary protocol with 4 KB chunked buffers for lossless audio delivery.',
            highlights: [
                'Engineered a TCP/IP socket-based media server and client in Python to query song directories and stream audio files reliably across local network endpoints.',
                'Implemented a custom text-and-binary protocol utilizing 4 KB chunked data buffers, ensuring lossless file transfer and responsive GUI playback.'
            ]
        },
        {
            id: 'project-ml',
            zoneTag: 'West Hub • Machine Learning',
            shortTitle: 'Car ML Classifier',
            title: 'Car Roadworthiness Classifier',
            role: 'Machine Learning Developer',
            period: 'Mar 2026',
            accent: '#c850ff',
            techStack: [
                'Python',
                'Google Colab',
                'Scikit-learn',
                'Pandas',
                'Seaborn',
                'Random Forest'
            ],
            summary:
                'End-to-end multi-class machine learning pipeline evaluating vehicle roadworthiness across 6 mechanical and safety attributes with full diagnostic evaluation.',
            highlights: [
                'Built an end-to-end multi-class classification pipeline in Google Colab using Random Forest to evaluate vehicle roadworthiness across 6 key mechanical and safety attributes.',
                'Preprocessed categorical attributes via Label Encoding, validated performance with Confusion Matrices, and visualized Feature Importance insights for a scientific research poster.'
            ]
        }
    ],

    experience: [
        {
            role: 'Laboratory Teaching Assistant – Digital Systems',
            organization: 'Universitas Prasetiya Mulya',
            period: 'Aug 2026 – Present',
            highlights: [
                'Mentored undergraduate students on logic gates, combinational circuits, and microcontroller interfacing.',
                'Guided live hardware-software debugging and supported students throughout practical laboratory sessions.'
            ]
        },
        {
            role: 'Laboratory Teaching Assistant – Electronic Circuits 1',
            organization: 'Universitas Prasetiya Mulya',
            period: 'Aug 2026 – Present',
            highlights: [
                'Facilitated introductory practicum sessions covering fundamental circuit analysis and breadboard prototyping.',
                'Assisted students with component assembly and multimeter diagnostics for accurate voltage and current measurements.'
            ]
        }
    ],

    organizations: [
        {
            role: 'Coordinator of Internal Relations',
            organization: 'QUANTUM (AI & Robotics Student Association)',
            period: 'Aug 2026 – Present',
            highlights: [
                'Led the internal relations division to strengthen member engagement, cross-batch communication, and organizational culture.',
                'Coordinated internal community initiatives, team-building programs, and cross-division collaboration.'
            ]
        },
        {
            role: 'Staff of Internal Relations',
            organization: 'SISO (STEM Student Association)',
            period: 'Aug 2025 – Aug 2026',
            highlights: [
                'Facilitated internal communication channels and supported member engagement activities across the STEM student body.',
                'Collaborated with cross-functional divisions to execute work programs and internal gatherings.'
            ]
        },
        {
            role: 'Coordinator of Documentation',
            organization: 'STEM Welcoming Night',
            period: 'Aug 2025',
            badge: '200+ Attendees',
            highlights: [
                'Led a media team in event coverage, photography, and end-to-end publication asset production for 200+ attendees.'
            ]
        }
    ],

    skills: [
        {
            group: 'Languages',
            items: ['Python', 'C++', 'SQL']
        },
        {
            group: 'AI & Data Science',
            items: ['PyTorch', 'OpenCV', 'Scikit-learn', 'YOLOv8', 'NumPy', 'Pandas']
        },
        {
            group: 'Embedded & Hardware',
            items: [
                'ESP32',
                'Arduino',
                'Microcontroller Interfacing',
                'Sensor Integration',
                'Breadboard Prototyping',
                'PCB'
            ]
        },
        {
            group: 'Tools & Platforms',
            items: ['Git', 'GitHub', 'Arduino IDE', 'Fusion']
        }
    ],

    spokenLanguages: ['Indonesian (Native)', 'English (Intermediate)'],

    certifications: [
        {
            title: 'Google AI Talent Development Program',
            issuer: 'Google, Coordinating Ministry for Economic Affairs RI & Coursera',
            year: '2026'
        }
    ]
}
