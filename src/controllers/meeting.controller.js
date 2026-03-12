import prisma from '../config/database.js';
import { success, error, paginated } from '../utils/response.js';
import { getPagination } from '../utils/pagination.js';

// ─── Get My Meetings ──────────────────────────────────────────
export const getMyMeetings = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const { status, upcoming } = req.query;
    const userId = req.user.id;

    const where = {
      OR: [{ ownerId: userId }, { attendeeId: userId }],
      ...(status   && { status }),
      ...(upcoming === 'true' && { scheduledAt: { gt: new Date() }, status: { in: ['SCHEDULED', 'CONFIRMED'] } }),
    };

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
        include: {
          property: {
            select: {
              id: true, title: true, city: true, locality: true, address: true,
              images: { where: { isPrimary: true }, take: 1, select: { thumbnailUrl: true } },
            },
          },
          owner: {
            select: { id: true, phone: true, profile: { select: { firstName: true, lastName: true, profileImage: true } } },
          },
          attendee: {
            select: { id: true, phone: true, profile: { select: { firstName: true, lastName: true, profileImage: true } } },
          },
        },
      }),
      prisma.meeting.count({ where }),
    ]);

    return res.json(paginated(meetings, total, page, limit));
  } catch (err) {
    console.error('getMyMeetings error:', err);
    return res.status(500).json(error('Failed to fetch meetings.'));
  }
};

// ─── Schedule Meeting ─────────────────────────────────────────
export const scheduleMeeting = async (req, res) => {
  try {
    const {
      propertyId, ownerId, scheduledAt, duration = 30,
      meetingType = 'IN_PERSON', location, meetingLink, notes,
    } = req.body;

    // Can't schedule with yourself
    if (ownerId === req.user.id) {
      return res.status(400).json(error('Cannot schedule a meeting with yourself.'));
    }

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return res.status(404).json(error('Property not found.'));

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate < new Date()) {
      return res.status(400).json(error('Meeting cannot be scheduled in the past.'));
    }

    const meeting = await prisma.meeting.create({
      data: {
        propertyId,
        ownerId,
        attendeeId:  req.user.id,
        scheduledAt: scheduledDate,
        duration:    Number(duration),
        meetingType,
        location,
        meetingLink,
        notes,
      },
      include: {
        property: { select: { id: true, title: true, address: true, city: true, locality: true } },
        owner: {
          select: { id: true, phone: true, profile: { select: { firstName: true, lastName: true } } },
        },
        attendee: {
          select: { id: true, phone: true, profile: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Create notification for property owner
    await prisma.notification.create({
      data: {
        userId:    ownerId,
        type:      'MEETING_REMINDER',
        title:     'New Visit Scheduled',
        message:   `${meeting.attendee.profile?.firstName} has scheduled a visit for "${property.title}" on ${scheduledDate.toLocaleDateString()}.`,
        data:      { meetingId: meeting.id, propertyId },
        actionUrl: `/meetings/${meeting.id}`,
      },
    }).catch(console.error);

    return res.status(201).json(success(meeting, 'Meeting scheduled successfully!'));
  } catch (err) {
    console.error('scheduleMeeting error:', err);
    return res.status(500).json(error('Failed to schedule meeting.'));
  }
};

// ─── Update Meeting Status ────────────────────────────────────
export const updateMeeting = async (req, res) => {
  try {
    const { status, scheduledAt, location, meetingLink, notes, cancelReason } = req.body;
    const userId = req.user.id;

    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, OR: [{ ownerId: userId }, { attendeeId: userId }] },
    });

    if (!meeting) return res.status(404).json(error('Meeting not found.'));

    const updated = await prisma.meeting.update({
      where: { id: req.params.id },
      data: {
        ...(status      && { status }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt), status: 'RESCHEDULED' }),
        ...(location    && { location }),
        ...(meetingLink && { meetingLink }),
        ...(notes       && { notes }),
        ...(cancelReason && { cancelReason }),
      },
      include: {
        property: { select: { id: true, title: true } },
        owner:    { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        attendee: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
      },
    });

    // Notify the other party
    const notifyUserId = meeting.ownerId === userId ? meeting.attendeeId : meeting.ownerId;
    const statusMessages = {
      CONFIRMED:    'confirmed your visit',
      CANCELLED:    'cancelled the visit',
      RESCHEDULED:  'rescheduled the visit',
      COMPLETED:    'marked the visit as completed',
    };

    if (statusMessages[status]) {
      const actor = updated.ownerId === userId ? updated.owner : updated.attendee;
      await prisma.notification.create({
        data: {
          userId:    notifyUserId,
          type:      'VISIT_REMINDER',
          title:     `Visit ${status.charAt(0) + status.slice(1).toLowerCase()}`,
          message:   `${actor.profile?.firstName} has ${statusMessages[status]} for "${updated.property?.title}".`,
          data:      { meetingId: meeting.id },
          actionUrl: `/meetings/${meeting.id}`,
        },
      }).catch(console.error);
    }

    return res.json(success(updated, 'Meeting updated.'));
  } catch (err) {
    console.error('updateMeeting error:', err);
    return res.status(500).json(error('Failed to update meeting.'));
  }
};

// ─── Get Meeting by ID ────────────────────────────────────────
export const getMeetingById = async (req, res) => {
  try {
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: req.params.id,
        OR: [{ ownerId: req.user.id }, { attendeeId: req.user.id }],
      },
      include: {
        property: {
          select: {
            id: true, title: true, address: true, city: true,
            locality: true, latitude: true, longitude: true,
            images: { where: { isPrimary: true }, take: 1, select: { thumbnailUrl: true } },
          },
        },
        owner: {
          select: {
            id: true, phone: true, email: true,
            profile: { select: { firstName: true, lastName: true, profileImage: true } },
          },
        },
        attendee: {
          select: {
            id: true, phone: true, email: true,
            profile: { select: { firstName: true, lastName: true, profileImage: true } },
          },
        },
      },
    });

    if (!meeting) return res.status(404).json(error('Meeting not found.'));
    return res.json(success(meeting));
  } catch (err) {
    console.error('getMeetingById error:', err);
    return res.status(500).json(error('Failed to fetch meeting.'));
  }
};

