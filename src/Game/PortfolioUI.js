import { Game } from './Game.js'
import { PORTFOLIO_DATA } from '../data/portfolioData.js'

export class PortfolioUI
{
    constructor()
    {
        this.game = Game.getInstance()
        this.gpaStatus = 'classified' // 'classified' | 'pending'
        this.forceAttempts = 0
        this.toastTimeout = null

        this.renderDrawersAndModals()
        this.bindEvents()
        this.syncGpaUi()

        this.game.modals.refreshItems()
        this.game.modals.events.on('open', (name) => this.syncNavActive(name))
        this.game.modals.events.on('close', () => this.syncNavActive(null))
    }

    escapeHtml(str)
    {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    }

    showToast(message)
    {
        const toastEl = document.querySelector('.js-toast')
        if(!toastEl)
            return

        toastEl.textContent = message
        toastEl.classList.add('is-visible')

        if(this.toastTimeout)
            clearTimeout(this.toastTimeout)

        this.toastTimeout = setTimeout(() =>
        {
            toastEl.classList.remove('is-visible')
        }, 3200)
    }

    triggerMailto(subject = null)
    {
        const email = PORTFOLIO_DATA.profile.contacts.email
        const href = subject
            ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
            : `mailto:${email}`

        if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function')
        {
            navigator.clipboard.writeText(email).catch(() => {})
        }

        const link = document.createElement('a')
        link.href = href
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        link.remove()
    }

    triggerContact(key)
    {
        const { contacts } = PORTFOLIO_DATA.profile

        if(key === 'github')
        {
            window.open(contacts.github, '_blank', 'noopener,noreferrer')
            this.showToast('Opening GitHub profile...')
        }
        else if(key === 'linkedin')
        {
            window.open(contacts.linkedin, '_blank', 'noopener,noreferrer')
            this.showToast('Opening LinkedIn profile...')
        }
        else if(key === 'email')
        {
            this.triggerMailto()
            this.showToast(`Email copied (${contacts.email}) • opening mail client`)
        }
    }

    renderProjectsDrawer()
    {
        const cardsHtml = PORTFOLIO_DATA.projects
            .map((project, index) => `
                <section class="project-card js-project-card" data-project-id="${this.escapeHtml(project.id)}" style="--card-accent: ${this.escapeHtml(project.accent)}">
                    <div class="project-card-top">
                        <div>
                            <span class="micro-tag">0${index + 1} &bull; ${this.escapeHtml(project.zoneTag)}</span>
                            <h3 class="card-title">${this.escapeHtml(project.title)}</h3>
                            <p class="card-meta">${this.escapeHtml(project.role)} &bull; ${this.escapeHtml(project.period)}</p>
                        </div>
                        <button type="button" class="focus-3d-btn js-focus-landmark" data-landmark="${this.escapeHtml(project.id)}" title="Focus 3D Landmark">
                            Focus 3D
                        </button>
                    </div>
                    <p class="card-summary">${this.escapeHtml(project.summary)}</p>
                    <div class="chip-row">
                        ${project.techStack.map(t => `<span class="chip">${this.escapeHtml(t)}</span>`).join('')}
                    </div>
                    <ul class="detail-list">
                        ${project.highlights.map(h => `<li>${this.escapeHtml(h)}</li>`).join('')}
                    </ul>
                </section>
            `)
            .join('')

        return `
            <aside class="glass-drawer js-modal" data-name="projects">
                <div class="panel-header">
                    <div>
                        <span class="micro-tag">Technical Projects</span>
                        <h2 class="panel-title">Engineering Portfolio</h2>
                    </div>
                    <button type="button" class="panel-close js-close" aria-label="Close Projects">Esc</button>
                </div>
                <div class="panel-body">
                    ${cardsHtml}
                </div>
            </aside>
        `
    }

    renderExperienceDrawer()
    {
        const expHtml = PORTFOLIO_DATA.experience
            .map(item => `
                <article class="entry-card">
                    <div class="entry-top">
                        <h3>${this.escapeHtml(item.role)}</h3>
                        <span class="date-pill">${this.escapeHtml(item.period)}</span>
                    </div>
                    <p class="entry-org">${this.escapeHtml(item.organization)}</p>
                    <ul class="detail-list">
                        ${item.highlights.map(h => `<li>${this.escapeHtml(h)}</li>`).join('')}
                    </ul>
                </article>
            `)
            .join('')

        const orgHtml = PORTFOLIO_DATA.organizations
            .map(item => `
                <article class="entry-card">
                    <div class="entry-top">
                        <h3>${this.escapeHtml(item.role)}</h3>
                        <span class="date-pill">${this.escapeHtml(item.period)}</span>
                    </div>
                    <p class="entry-org">
                        <span>${this.escapeHtml(item.organization)}</span>
                        ${item.badge ? `<span class="accent-pill">${this.escapeHtml(item.badge)}</span>` : ''}
                    </p>
                    <ul class="detail-list">
                        ${item.highlights.map(h => `<li>${this.escapeHtml(h)}</li>`).join('')}
                    </ul>
                </article>
            `)
            .join('')

        return `
            <aside class="glass-drawer js-modal" data-name="experience">
                <div class="panel-header">
                    <div>
                        <span class="micro-tag">Academic &amp; Leadership</span>
                        <h2 class="panel-title">Experience</h2>
                    </div>
                    <button type="button" class="panel-close js-close" aria-label="Close Experience">Esc</button>
                </div>
                <div class="panel-body">
                    <div class="drawer-section">
                        <h3 class="section-label">Teaching Assistantships</h3>
                        <div class="entry-stack">${expHtml}</div>
                    </div>
                    <div class="drawer-section">
                        <h3 class="section-label">Organizations &amp; Leadership</h3>
                        <div class="entry-stack">${orgHtml}</div>
                    </div>
                </div>
            </aside>
        `
    }

    renderSkillsDrawer()
    {
        const skillsHtml = PORTFOLIO_DATA.skills
            .map(group => `
                <div class="entry-card">
                    <h3 class="skill-group-title">${this.escapeHtml(group.group)}</h3>
                    <div class="chip-row">
                        ${group.items.map(skill => `<span class="chip">${this.escapeHtml(skill)}</span>`).join('')}
                    </div>
                </div>
            `)
            .join('')

        const certsHtml = PORTFOLIO_DATA.certifications
            .map(cert => `
                <div class="cert-card">
                    <div class="entry-top">
                        <h3>${this.escapeHtml(cert.title)}</h3>
                        <span class="date-pill">${this.escapeHtml(cert.year)}</span>
                    </div>
                    <p class="entry-org">${this.escapeHtml(cert.issuer)}</p>
                </div>
            `)
            .join('')

        return `
            <aside class="glass-drawer js-modal" data-name="skills">
                <div class="panel-header">
                    <div>
                        <span class="micro-tag">Capabilities &amp; Credentials</span>
                        <h2 class="panel-title">Skills &amp; Certifications</h2>
                    </div>
                    <button type="button" class="panel-close js-close" aria-label="Close Skills">Esc</button>
                </div>
                <div class="panel-body">
                    <div class="drawer-section">
                        <h3 class="section-label">Technical Stack</h3>
                        <div class="entry-stack">${skillsHtml}</div>
                    </div>
                    <div class="drawer-section">
                        <h3 class="section-label">Spoken Languages</h3>
                        <div class="chip-row">
                            ${PORTFOLIO_DATA.spokenLanguages.map(lang => `<span class="chip muted">${this.escapeHtml(lang)}</span>`).join('')}
                        </div>
                    </div>
                    <div class="drawer-section">
                        <h3 class="section-label">Certifications</h3>
                        ${certsHtml}
                    </div>
                </div>
            </aside>
        `
    }

    renderEducationDrawer()
    {
        const { profile, education } = PORTFOLIO_DATA
        const { gpaGimmick } = education

        return `
            <aside class="glass-drawer js-modal" data-name="education">
                <div class="panel-header">
                    <div>
                        <span class="micro-tag">Profile &amp; Academics</span>
                        <h2 class="panel-title">Education</h2>
                    </div>
                    <button type="button" class="panel-close js-close" aria-label="Close Education">Esc</button>
                </div>
                <div class="panel-body">
                    <div class="entry-card profile-overview-card">
                        <h3>${this.escapeHtml(profile.name)}</h3>
                        <p class="card-meta">${this.escapeHtml(profile.role)} &bull; ${this.escapeHtml(profile.location)}</p>
                        <p class="tagline-quote">&ldquo;${this.escapeHtml(profile.tagline)}&rdquo;</p>
                        <p class="card-summary">${this.escapeHtml(profile.summary)}</p>
                    </div>

                    <div class="entry-card">
                        <div class="entry-top">
                            <h3>${this.escapeHtml(education.institution)}</h3>
                            <span class="date-pill">${this.escapeHtml(education.period)}</span>
                        </div>
                        <p class="card-meta">${this.escapeHtml(education.degree)}</p>
                        <p class="entry-org">${this.escapeHtml(education.location)}</p>

                        <div class="gpa-vault-strip">
                            <span class="gpa-badge js-gpa-badge">${this.escapeHtml(gpaGimmick.defaultBadge)}</span>
                            <button type="button" class="glass-btn primary small js-open-gpa-gate">
                                ${this.escapeHtml(gpaGimmick.triggerButton)}
                            </button>
                        </div>
                    </div>

                    <div class="drawer-contact-row">
                        <button type="button" class="glass-btn secondary small js-contact-action" data-contact="email">Email</button>
                        <button type="button" class="glass-btn secondary small js-contact-action" data-contact="github">GitHub</button>
                        <button type="button" class="glass-btn secondary small js-contact-action" data-contact="linkedin">LinkedIn</button>
                    </div>
                </div>
            </aside>
        `
    }

    renderGpaGateModal()
    {
        const { education } = PORTFOLIO_DATA
        const { gpaGimmick } = education

        return `
            <article class="glass-modal js-modal js-gpa-modal-card" data-name="gpa-gate">
                <div class="panel-header">
                    <div>
                        <span class="micro-tag">Academic Vault &bull; Restricted Access</span>
                        <h2 class="panel-title">GPA Clearance Check</h2>
                    </div>
                    <button type="button" class="panel-close js-close" aria-label="Close GPA Vault">Esc</button>
                </div>
                <div class="panel-body">
                    <div class="gpa-badge large js-gpa-badge js-gpa-modal-badge">
                        ${this.escapeHtml(gpaGimmick.defaultBadge)}
                    </div>

                    <p class="gpa-prompt-text">${this.escapeHtml(gpaGimmick.prompt)}</p>

                    <div class="gpa-actions-row">
                        <button type="button" class="glass-btn primary js-gpa-hire">
                            ${this.escapeHtml(gpaGimmick.hireButton)}
                        </button>
                        <button type="button" class="glass-btn secondary js-gpa-force">
                            ${this.escapeHtml(gpaGimmick.forceButton)}
                        </button>
                    </div>

                    <div class="gpa-feedback js-gpa-feedback" role="status" aria-live="polite"></div>

                    <div class="gpa-modal-footer">
                        <button type="button" class="text-link-btn js-switch-drawer" data-drawer="education">
                            View Full Education &amp; Profile →
                        </button>
                    </div>
                </div>
            </article>
        `
    }

    renderDrawersAndModals()
    {
        const container = document.querySelector('.js-modals')
        if(!container)
            return

        container.innerHTML = [
            this.renderProjectsDrawer(),
            this.renderExperienceDrawer(),
            this.renderSkillsDrawer(),
            this.renderEducationDrawer(),
            this.renderGpaGateModal()
        ].join('')
    }

    syncNavActive(modalName)
    {
        const navButtons = document.querySelectorAll('.js-nav-pill')
        for(const btn of navButtons)
        {
            const target = btn.dataset.drawer
            const isActive = target === modalName || (modalName === 'gpa-gate' && target === 'education')
            btn.classList.toggle('is-active', isActive)
        }
    }

    syncGpaUi()
    {
        const { gpaGimmick } = PORTFOLIO_DATA.education
        const isPending = this.gpaStatus === 'pending'
        const badgeText = isPending ? gpaGimmick.pendingBadge : gpaGimmick.defaultBadge

        const badges = document.querySelectorAll('.js-gpa-badge')
        for(const badge of badges)
        {
            badge.textContent = badgeText
            badge.classList.toggle('is-pending', isPending)
        }
    }

    openDrawer(drawerName)
    {
        const cam = this.game.world?.landmarks?.getCinematicCamera(drawerName) || null
        this.game.modals.open(drawerName, cam)
    }

    openProjectsDrawer(highlightProjectId = null)
    {
        const camKey = highlightProjectId || 'project-robotics'
        const cam = this.game.world?.landmarks?.getCinematicCamera(camKey) || null
        this.game.modals.open('projects', cam)

        const cards = document.querySelectorAll('.js-project-card')
        for(const card of cards)
        {
            const isMatch = highlightProjectId && card.dataset.projectId === highlightProjectId
            card.classList.toggle('is-highlighted', !!isMatch)
            if(isMatch)
            {
                requestAnimationFrame(() =>
                {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                })
            }
        }
    }

    handleHireOffer()
    {
        const { gpaGimmick } = PORTFOLIO_DATA.education
        this.gpaStatus = 'pending'
        this.syncGpaUi()

        // Update 3D Academic Vault beacon to warm amber while staying locked
        this.game.world?.landmarks?.setPendingOfferState()

        const feedbackEl = document.querySelector('.js-gpa-feedback')
        if(feedbackEl)
        {
            feedbackEl.textContent = gpaGimmick.hireReply
            feedbackEl.classList.remove('is-denied', 'is-shaking')
            feedbackEl.classList.add('is-visible', 'is-pending')
        }

        this.triggerMailto(gpaGimmick.mailtoSubject)
        this.showToast('Email copied • opening mail client with pre-filled offer subject')
    }

    handleForceUnlockAttempt()
    {
        const { gpaGimmick } = PORTFOLIO_DATA.education
        this.forceAttempts += 1

        const replyIndex = Math.min(this.forceAttempts - 1, gpaGimmick.forceReplies.length - 1)
        const replyText = gpaGimmick.forceReplies[replyIndex]

        const feedbackEl = document.querySelector('.js-gpa-feedback')
        const modalCard = document.querySelector('.js-gpa-modal-card')
        const modalBadge = document.querySelector('.js-gpa-modal-badge')

        if(feedbackEl)
        {
            feedbackEl.textContent = replyText
            feedbackEl.classList.remove('is-pending')
            feedbackEl.classList.add('is-visible', 'is-denied')
        }

        // Trigger crisp shake animation on modal card & badge
        for(const target of [modalCard, modalBadge])
        {
            if(!target)
                continue
            target.classList.remove('is-shaking')
            void target.offsetWidth
            target.classList.add('is-shaking')
        }

        // Trigger 3D Academic Vault "denied bounce" + red strobe beacon
        this.game.world?.landmarks?.triggerDeniedBounce()
    }

    bindEvents()
    {
        // Minimal top-left Identity Chip -> opens Education & Profile drawer
        const identityBtn = document.querySelector('.js-identity-chip')
        if(identityBtn)
        {
            identityBtn.addEventListener('click', () =>
            {
                this.openDrawer('education')
            })
        }

        // Floating Capsule Navigation Pill (Projects | Experience | Skills | Education)
        const navButtons = document.querySelectorAll('.js-nav-pill')
        for(const btn of navButtons)
        {
            btn.addEventListener('click', () =>
            {
                const drawer = btn.dataset.drawer
                if(!drawer)
                    return

                if(drawer === 'projects')
                    this.openProjectsDrawer(null)
                else
                    this.openDrawer(drawer)
            })
        }

        // Bottom-right subtle Quick Contact Dock (icon-only)
        const quickContactBtns = document.querySelectorAll('.js-quick-contact')
        for(const btn of quickContactBtns)
        {
            btn.addEventListener('click', () =>
            {
                const key = btn.dataset.contact
                if(key)
                    this.triggerContact(key)
            })
        }

        // Delegated clicks inside Modals & Drawers container
        const modalsContainer = document.querySelector('.js-modals')
        if(modalsContainer)
        {
            modalsContainer.addEventListener('click', (event) =>
            {
                if(event.target.closest('.js-open-gpa-gate'))
                {
                    const cam = this.game.world?.landmarks?.getCinematicCamera('education') || null
                    this.game.modals.open('gpa-gate', cam)
                    return
                }

                if(event.target.closest('.js-gpa-hire'))
                {
                    this.handleHireOffer()
                    return
                }

                if(event.target.closest('.js-gpa-force'))
                {
                    this.handleForceUnlockAttempt()
                    return
                }

                const focusBtn = event.target.closest('.js-focus-landmark')
                if(focusBtn)
                {
                    const landmarkId = focusBtn.dataset.landmark
                    const cam = this.game.world?.landmarks?.getCinematicCamera(landmarkId)
                    if(cam)
                    {
                        this.game.view.cinematic.start(cam.position, cam.target)
                        const cards = document.querySelectorAll('.js-project-card')
                        for(const card of cards)
                            card.classList.toggle('is-highlighted', card.dataset.projectId === landmarkId)
                    }
                    return
                }

                const switchBtn = event.target.closest('.js-switch-drawer')
                if(switchBtn)
                {
                    const targetDrawer = switchBtn.dataset.drawer
                    if(targetDrawer)
                        this.openDrawer(targetDrawer)
                    return
                }

                const contactBtn = event.target.closest('.js-contact-action')
                if(contactBtn)
                {
                    const key = contactBtn.dataset.contact
                    if(key)
                        this.triggerContact(key)
                }
            })
        }
    }
}
