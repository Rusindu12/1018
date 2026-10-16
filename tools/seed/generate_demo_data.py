#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regenerates the bundled demo catalogue:

    app/assets/data/demo_books.json
    app/assets/data/demo_papers.json

The app ships these so that a fresh clone (with no Firebase project) shows a
real, filterable catalogue: grade 1-13 textbooks and past papers from 2015-2024
in all three mediums, with Sinhala/Tamil titles where the medium needs them.

Every PDF URL points at the bundled sample PDF, so downloading, the offline
reader, favourites and bookmarks can all be exercised with no network at all.

Usage:  python3 tools/seed/generate_demo_data.py
"""
import json
import os
import sys
from datetime import datetime, timedelta

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_DIR = os.path.join(ROOT, 'app', 'assets', 'data')

SAMPLE_PDF = 'asset:sample/sample_paper.pdf'

SUBJECTS = {
    'Mathematics': ('ගණිතය', 'கணிதம்'),
    'Science': ('විද්‍යාව', 'அறிவியல்'),
    'Sinhala Language': ('සිංහල භාෂාව', 'சிங்கள மொழி'),
    'Tamil Language': ('දෙමළ භාෂාව', 'தமிழ் மொழி'),
    'English Language': ('ඉංග්‍රීසි භාෂාව', 'ஆங்கில மொழி'),
    'History': ('ඉතිහාසය', 'வரலாறு'),
    'Geography': ('භූගෝල විද්‍යාව', 'புவியியல்'),
    'ICT': ('තොරතුරු තාක්ෂණය', 'தகவல் தொழில்நுட்பம்'),
    'Buddhism': ('බුද්ධ ධර්මය', 'பௌத்தம்'),
    'Agriculture': ('කෘෂිකර්මය', 'விவசாயம்'),
    'Business & Accounting Studies': ('ව්‍යාපාර හා ගිණුම්කරණය', 'வணிகம் & கணக்கியல்'),
    'Combined Mathematics': ('සංයුක්ත ගණිතය', 'சேர்க்கைக் கணிதம்'),
    'Biology': ('ජීව විද්‍යාව', 'உயிரியல்'),
    'Physics': ('භෞතික විද්‍යාව', 'பௌதிகவியல்'),
    'Chemistry': ('රසායන විද්‍යාව', 'வேதியியல்'),
    'Business Studies': ('ව්‍යාපාර අධ්‍යයනය', 'வணிகக் கல்வி'),
    'Accounting': ('ගිණුම්කරණය', 'கணக்கியல்'),
    'Economics': ('ආර්ථික විද්‍යාව', 'பொருளியல்'),
    'General Knowledge': ('සාමාන්‍ය දැනුම', 'பொது அறிவு'),
}

BANDS = {
    'primary': (1, 5, ['Mathematics', 'Sinhala Language', 'Tamil Language', 'English Language', 'Buddhism']),
    'junior': (6, 9, ['Mathematics', 'Science', 'Sinhala Language', 'English Language', 'History', 'Geography', 'ICT']),
    'senior': (10, 11, ['Mathematics', 'Science', 'Sinhala Language', 'English Language',
                        'Business & Accounting Studies', 'ICT']),
    'advanced': (12, 13, ['Combined Mathematics', 'Biology', 'Physics', 'Chemistry',
                          'Business Studies', 'Accounting', 'Economics']),
}

MEDIUMS = ['Sinhala', 'English', 'Tamil']


def subject_title(subject, medium, grade, kind='book'):
    si, ta = SUBJECTS[subject]
    if medium == 'Sinhala':
        return '%s %d ශ්‍රේණිය' % (si, grade) if kind == 'book' else si
    if medium == 'Tamil':
        return '%s %d ஆம் தரம்' % (ta, grade) if kind == 'book' else ta
    return '%s Grade %d' % (subject, grade) if kind == 'book' else subject


def deterministic_timestamp(index, days_back=180):
    """Spreads items over the last few months so 'newest first' means something."""
    base = datetime(2024, 8, 1, 9, 0, 0)
    return (base + timedelta(hours=index * 7)).isoformat() + 'Z'


def build_books():
    books = []
    index = 0
    for band, (low, high, subjects) in BANDS.items():
        for grade in range(low, high + 1):
            for subject in subjects:
                for medium in MEDIUMS:
                    # Full coverage on purpose: every grade/subject/medium
                    # combination the filters can produce must return rows, so
                    # demo mode demonstrates the real behaviour. The whole
                    # catalogue still costs well under 100 KB in the APK.
                    index += 1
                    title = subject_title(subject, medium, grade)
                    size_mb = 6 + ((index * 7) % 20) + (index % 5) * 0.5
                    books.append({
                        'id': 'demo_book_%03d' % index,
                        'title': title,
                        'grade': grade,
                        'subject': subject,
                        'medium': medium,
                        'coverUrl': '',
                        'pdfUrl': SAMPLE_PDF,
                        'fileSize': '%.1f MB' % size_mb,
                        'fileSizeBytes': int(size_mb * 1024 * 1024),
                        'year': 2024 if band != 'primary' else 2023,
                        'category': 'textbook' if index % 7 else 'workbook',
                        'pages': 80 + (index * 13) % 220,
                        'downloads': 350 + (index * 137) % 9000,
                        'timestamp': deterministic_timestamp(index),
                    })
    return books


# Kept deliberately compact (the file is bundled in the APK) while still
# covering every filter the UI offers: 4 exam families x several years x all
# mediums x the paper types each family actually uses.
PAPER_SUBJECTS = {
    'OL': ['Mathematics', 'Science', 'Sinhala Language'],
    'AL': ['Combined Mathematics', 'Biology'],
    'Scholarship': ['General Knowledge'],
    'TermTest': ['Mathematics', 'Science'],
}

PAPER_MEDIUMS = {
    'OL': ['Sinhala', 'English', 'Tamil'],
    'AL': ['Sinhala', 'English'],
    'Scholarship': ['Sinhala', 'Tamil'],
    'TermTest': ['Sinhala'],
}

PAPER_TYPES = {
    'OL': ['Paper 1', 'Paper 2'],
    'AL': ['Paper 1', 'Paper 2'],
    'Scholarship': ['MCQ'],
    'TermTest': ['Term Test'],
}

YEARS = {
    'OL': [2024, 2023, 2022, 2021, 2020, 2019],
    'AL': list(range(2024, 2017, -1)),
    'Scholarship': [2024, 2023, 2022, 2021, 2020, 2019],
    'TermTest': [2024, 2023],
}

TERMS = {
    'TermTest': [1, 2, 3],
    'OL': [None],
    'AL': [None],
    'Scholarship': [None],
}


def paper_title(exam_type, year, subject, medium, paper_type, grade, term):
    """Builds the title students would see on the printed paper, in the medium
    the paper is written in."""
    si, ta = SUBJECTS[subject]
    subject_name = {'Sinhala': si, 'Tamil': ta, 'English': subject}[medium]

    part = {
        'Paper 1': {'Sinhala': 'ප්‍රශ්න පත්‍රය 1', 'Tamil': 'தாள் 1', 'English': 'Paper 1'},
        'Paper 2': {'Sinhala': 'ප්‍රශ්න පත්‍රය 2', 'Tamil': 'தாள் 2', 'English': 'Paper 2'},
        'MCQ': {'Sinhala': 'බහුවරණ', 'Tamil': 'பல்தேர்வு', 'English': 'MCQ'},
        'Term Test': {
            'Sinhala': '%s වාරය' % term,
            'Tamil': '%s ஆம் தவணை' % term,
            'English': 'Term %s' % term,
        },
        'Marking Scheme': {
            'Sinhala': 'පිළිතුරු පත්‍රිකාව',
            'Tamil': 'விடைகள் தாள்',
            'English': 'Marking Scheme',
        },
    }[paper_type][medium]

    if exam_type == 'OL':
        exam_label = {'Sinhala': 'සා.පෙළ', 'Tamil': 'சாதாரண தரம்', 'English': 'O/L'}[medium]
    elif exam_type == 'AL':
        exam_label = {'Sinhala': 'උසස් පෙළ', 'Tamil': 'உயர்தரம்', 'English': 'A/L'}[medium]
    elif exam_type == 'Scholarship':
        exam_label = {
            'Sinhala': '5 ශ්‍රේණි ශිෂ්‍යත්ව',
            'Tamil': 'தரம் 5 புலமைப்பரிசில்',
            'English': 'Grade 5 Scholarship',
        }[medium]
    else:
        grade_label = {
            'Sinhala': '%d ශ්‍රේණිය' % grade,
            'Tamil': 'தரம் %d' % grade,
            'English': 'Grade %d' % grade,
        }[medium]
        exam_label = '%s %s' % (
            grade_label,
            {'Sinhala': 'වාර පරීක්ෂණය', 'Tamil': 'தவணைப் பரீட்சை', 'English': 'Term Test'}[medium],
        )

    return '%d %s %s %s' % (year, exam_label, subject_name, part)


def build_papers():
    papers = []
    index = 0
    for exam_type, subjects in PAPER_SUBJECTS.items():
        for year in YEARS[exam_type]:
            for subject in subjects:
                for medium in PAPER_MEDIUMS[exam_type]:
                    for paper_type in PAPER_TYPES[exam_type]:
                        for term in TERMS[exam_type]:
                            index += 1
                            grade = None
                            if exam_type == 'Scholarship':
                                grade = 5
                            elif exam_type == 'TermTest':
                                grade = 6 + (index % 6)
                            # Two out of three papers have their answer key in
                            # the catalogue, which is what the badge reflects.
                            has_scheme = index % 3 != 0
                            size_mb = 1.2 + (index % 9) * 0.4
                            papers.append({
                                'id': 'demo_paper_%03d' % index,
                                'title': paper_title(exam_type, year, subject, medium, paper_type,
                                                     grade, term),
                                'examType': exam_type,
                                'year': year,
                                'subject': subject,
                                'medium': medium,
                                'paperType': paper_type,
                                'hasMarkingScheme': has_scheme,
                                'grade': grade,
                                'term': term,
                                'pdfUrl': SAMPLE_PDF,
                                'fileSize': '%.1f MB' % size_mb,
                                'fileSizeBytes': int(size_mb * 1024 * 1024),
                                'downloads': 120 + (index * 53) % 4000,
                                'timestamp': deterministic_timestamp(index, days_back=90),
                            })
    return papers


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    books = build_books()
    papers = build_papers()
    for name, rows in (('demo_books.json', books), ('demo_papers.json', papers)):
        path = os.path.join(OUT_DIR, name)
        with open(path, 'w', encoding='utf-8') as handle:
            json.dump(rows, handle, ensure_ascii=False, indent=1)
            handle.write('\n')
        size = os.path.getsize(path)
        print('%-18s %4d rows  %6.1f KB' % (name, len(rows), size / 1024.0))
    mediums = sorted({row['medium'] for row in books})
    grades = sorted({row['grade'] for row in books})
    exams = sorted({row['examType'] for row in papers})
    years = sorted({row['year'] for row in papers})
    print('books   : grades %s, mediums %s' % (grades, mediums))
    print('papers  : %s, years %s-%s' % (exams, min(years), max(years)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
