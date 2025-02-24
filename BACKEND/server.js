const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const morgan = require('morgan');   
const winston = require('winston');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));


// Connect to MongoDB
mongoose
    .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/student-mangement', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.log('MongoDB connection error: ', err));

// Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error'}),
        new winston.transports.File({ filename: 'combined.log'}),
        new winston.transports.Console({
            format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
        })
    ]
});

// Log all requests
const apiLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info({
            method: req.method,
            path:req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            params: req.params,
            query: req.query,
            body: req.method !== 'GET' ? req.body :undefined
        });
    });
    next();
}

// Log all API requests
app.use(apiLogger);

// Error handler
app.use((err, req, res, next) => {
    logger.error({
        message: err.message,
        stack: err.stack,
        path: req.path,
        params: req.params,
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined
    });

    res.status(500).json({message: 'Ineternal server error'});
});

// Student Schema
const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    course: {
        type: String,
        required: true
    },
    enrollmentDate: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
},
{
    timestamps: true,
});

// Student Model
const Student = mongoose.model('Student', studentSchema);

// Course Schema
const courseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
},
{
    timestamps: true,
});

// Course Model
const Course = mongoose.model('Course', courseSchema);


app.get('/api/all-courses', async (req, res) => {
    try {
        const courses = await Course.find().sort({ name: 1});
        logger.info('Retrieved ${courses.length} courses successfully');
        res.json(courses);
    } catch(error){
        logger.error('Error feteching courses: ', error);
        res.status(500).json({ message: error.message });
    }
});


app.post('/api/courses', async (req, res) => {
    try{
        const course = new Course(req.body);
        const savedCourse = await course.save();
        logger.info('New Course created successfully', {
            courseID: savedCourse._id,
            name: savedCourse.name,
        });
        res.status(201).json(savedCourse);
    } catch(error){
        logger.error('Error creating course: ', error);
        res.status(400).json({ message: error.message });
    }
});


app.put('/api/courses/:id', async (req, res) => {
    try{
        const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
        });
        if(!course){
            logger.warn('Course not found for update: ', { courseID: req.paramas.id });
            return res.status(404).json({ message: 'Course not found'});
        }
        logger.info('Course updated successfully: ', {
            courseID: course._id,
            name: course.name,
        });
        res.json(course);
    } catch(error){
        logger.error('Error updating course: ', error);
        res.status(404).json( { message: error.message });
    }
});


app.delete('/api/courses/:id', async (req, res) => {
    try{
        const enrolledStudents = await Student.countDocuments({ 
            course: req.params.id,
        });
        if(enrolledStudents > 0){
            logger.warm('Course cannot be deleted as students are enrolled: ', {
                courseId: req.params.id,
                enrolledStudents,
            });
            return res
                .status(400)
                .json({ message: 'Cannot delete course with enrolled students'});
        }
        const course = await Course.findByIdAndDelete(req.params.id);
        if(!course){
            logger.warn('Course not found for deletion: ', {
                courseId: req.params.id,
            });
            return res.status(404).json({ message: 'Course not found'});
        }
        logger.info('Course deleted successfully: ', {
            courseId: course._id,
            name: course.name,
        });
        res.json({ message: 'Course deleted successfully'});
    } catch(error){
        logger.error('Error deleting course: ', error);
        res.status(500).json({ message: error.message});
    }
});

app.get('/api/courses/:id', async(req,res) => {
    try{
        const course = await Course.findById(req.params.id);
        if(!course){
            return res.status(404).json({ message: 'Course not found'});
        }
        res,json(course);
    } catch(error){
        logger.error('Error fetching course:', error);
        res.status(500).json({ message: error.message});
    }
});


app.get('/api/all-students', async (req, res) => {
    try{
        const students = await Student.find().sort({ createdAt: -1});
        logger.info('Retrieved ${students.length} students successfully');
        res.json(students);
    } catch(error){
        logger.error('Error feteching students: ', error);
        res.status(500).json({ message: error.message });
    }
});


app.post('/api/students', async( req, res) => {
    try{
        const student = new Student(req.body);
        const savedStudent = await student.save();
        logger.info('New student created successfully', {
            studentId: savedStudent._id,
            name: savedStudent.name,
            course: savedStudent.course,
        });
        res.status(201).json(savedStudent);
    } catch(error){
        logger.error('Error creating student: ', error);
        res.status(400).json({ message: error.message });
    }
})